'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri, DeclarationInfo, ClangCursorExtent} from './main';

var {checkOutput, fsPromise, safeSpawn} = require('nuclide-commons');
var logger = require('nuclide-logging').getLogger();
var path = require('path');
var split = require('split');
var {EventEmitter} = require('events');
var ClangFlagsManager = require('./ClangFlagsManager');
var ClangService = require('./ClangService');
/* $FlowFixMe - module paths aren't supported */
var LocalBuckUtils = require('nuclide-buck-base/lib/LocalBuckUtils');

/**
 * Nuclide runs clang in its own process. For simplicity, it is run as a Python
 * program, as Python has a nice libclang wrapper.
 */
class LocalClangService extends ClangService {
  _asyncConnection: ?Promise<void>;
  _clangFlagsManager: ClangFlagsManager;
  _readableStream: any /*?stream$Readable*/;
  _writableStream: any /*?stream$Writable*/;
  _nextRequestId: number;
  _pathToLibClangServer: string;
  _emitter: EventEmitter;

  constructor() {
    super();
    this._asyncConnection = null;
    this._clangFlagsManager = new ClangFlagsManager(new LocalBuckUtils());
    this._readableStream = null;
    this._writableStream = null;
    this._nextRequestId = 1;
    this._pathToLibClangServer = path.join(__dirname, '../python/clang_server.py');
    this._emitter = new EventEmitter();
  }

  _connect(): Promise<void> {
    if (this._asyncConnection) {
      return this._asyncConnection;
    }

    var pathToLibClangServer = this._pathToLibClangServer;
    this._asyncConnection = new Promise(async (resolve, reject) => {
      var {ldLibraryPathEnv, pythonPathEnv, pythonExecutable} = await this._findClangServerArgs();
      var options = {
        cwd: path.dirname(pathToLibClangServer),
        // The process should use its ordinary stderr for errors.
        stdio: ['pipe', null, 'pipe', 'pipe'],
        detached: false, // When Atom is killed, clang_server.py should be killed, too.
        env: {
          LD_LIBRARY_PATH: ldLibraryPathEnv,
          PYTHONPATH: pythonPathEnv,
        },
      };

      // Note that safeSpawn() often overrides options.env.PATH, but that only happens when
      // options.env is undefined (which is not the case here). This will only be an issue if the
      // system cannot find `pythonExecutable`.
      var child = await safeSpawn(pythonExecutable, /* args */ [pathToLibClangServer], options);
      child.on('close', function(exitCode) {
        logger.error('%s exited with code %s', pathToLibClangServer, exitCode);
        this._asyncConnection = null;
      });
      child.stderr.on('data', function(error) {
        if (error instanceof Buffer) {
          error = error.toString('utf8');
        }
        logger.error('Error receiving data', error);
      });
      /* $FlowFixMe - update Flow defs for ChildProcess */
      var writableStream = child.stdio[3];

      // Make sure the bidirectional communication channel is set up before
      // resolving this Promise.
      child.stdout.once('data', function(data: Buffer) {
        if (data.toString() === 'ack\n') {
          var result = {
            readableStream: child.stdout,
            writableStream: writableStream,
          };
          resolve(result);
        } else {
          reject(data);
        }
      });
      writableStream.write('init\n');
    }).then((result) => {
      this._readableStream = result.readableStream;
      this._writableStream = result.writableStream;
      this._readableStream.pipe(split(JSON.parse)).on('data', (response) => {
        var id = response['reqid'];
        this._emitter.emit(id, response);
      });
    });

    return this._asyncConnection;
  }

  async _makeRequest(request: Object): Promise {
    await this._connect();

    var id = request['reqid'] = this._getNextRequestId();
    var logData = JSON.stringify(request, (key, value) => {
      // File contents are too large and clutter up the logs, so exclude them.
      if (key === 'contents') {
        return undefined;
      } else {
        return value;
      }
    });
    logger.debug('LibClang request: ' + logData);

    // Because Node uses an event-loop, we do not have to worry about a call to
    // write() coming in from another thread between our two calls here.
    this._writableStream.write(JSON.stringify(request));
    this._writableStream.write('\n');

    return new Promise((resolve, reject) => {
      this._emitter.once(id, (response) => {
        var isError = 'error' in response;
        if (isError) {
          logger.error('error received from clang_server.py for request:\n%o\nError:%s',
            logData,
            response['error']);
        }
        (isError ? reject : resolve)(response);
      });
    });
  }

  async _findClangServerArgs(): Promise<{
    ldLibraryPathEnv: ?string;
    pythonExecutable: string;
    pythonPathEnv: ?string;
  }> {
    var findClangServerArgs;
    try {
      findClangServerArgs = require('./fb/find-clang-server-args');
    } catch (e) {
      // Ignore.
    }

    var ldLibraryPathEnv;
    if (process.platform === 'darwin') {
      var result = await checkOutput('xcode-select', ['--print-path']);
      if (result.exitCode === 0) {
        ldLibraryPathEnv = result.stdout.trim() + '/Toolchains/XcodeDefault.xctoolchain/usr/lib/';
      }
    }

    var clangServerArgs = {
      ldLibraryPathEnv,
      pythonExecutable: 'python',
      pythonPathEnv: path.join(__dirname, '../pythonpath'),
    };
    if (typeof findClangServerArgs === 'function') {
      var clangServerArgsOverrides = await findClangServerArgs();
      return {...clangServerArgs, ...clangServerArgsOverrides};
    } else {
      return clangServerArgs;
    }
  }

  _getNextRequestId(): string {
    return (this._nextRequestId++).toString(16);
  }

  async compile(
    src: NuclideUri,
    contents: string
  ): Promise<{
    diagnostics: Array<{
      spelling: string;
      severity: number;
      location: {
        column: number;
        file: NuclideUri;
        line: number;
      };
      ranges: any;
    }>
  }> {
    var flags = await this._clangFlagsManager.getFlagsForSrc(src);
    return this._makeRequest({
      method: 'compile',
      src,
      contents,
      flags,
    });
  }

  async getCompletions(src: NuclideUri, contents: string, line: number, column: number,
      tokenStartColumn: number, prefix: string): Promise<any> {
    var flags = await this._clangFlagsManager.getFlagsForSrc(src);
    return this._makeRequest({
      method: 'get_completions',
      src,
      contents,
      line,
      column,
      tokenStartColumn,
      prefix,
      flags,
    });
  }

  /**
   * @return An Object with the following fields:
   *   file: NuclideUri of the source file where the declaration is.
   *   line: The line number of the declaration within `file`.
   *   column: The column number of the declaration within `file`.
   *   spelling: The spelling of the entity.
   */
  async getDeclaration(src: NuclideUri, contents: string, line: number, column: number
      ): Promise<?{
          file: NuclideUri;
          line: number;
          column: number;
          spelling: string;
          extent: ClangCursorExtent;
        }> {
    var flags = await this._clangFlagsManager.getFlagsForSrc(src);
    var data = await this._makeRequest({
      method: 'get_declaration',
      src,
      contents,
      line,
      column,
      flags,
    });

    var {locationAndSpelling} = data;

    if (!locationAndSpelling) {
      return null;
    }

    var state = await fsPromise.lstat(locationAndSpelling.file);
    if (state.isSymbolicLink()) {
      locationAndSpelling.file = await fsPromise.readlink(locationAndSpelling.file);
    }

    return locationAndSpelling;
  }

  async getDeclarationInfo(
    src: NuclideUri,
    contents: string,
    line: number,
    column: number
  ): Promise<?DeclarationInfo> {
    var flags = await this._clangFlagsManager.getFlagsForSrc(src);
    return this._makeRequest({
      method: 'get_declaration_info',
      src,
      contents,
      line,
      column,
      flags,
    });
  }
}

module.exports = LocalClangService;
