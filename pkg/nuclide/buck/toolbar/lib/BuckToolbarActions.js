'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {Dispatcher} = require('flux');
var {TextEditor} = require('atom');

class BuckToolbarActions {

  _dispatcher: Dispatcher;

  static ActionType: {[key:string]: string};

  constructor(dispatcher: Dispatcher) {
    this._dispatcher = dispatcher;
  }

  updateProjectFor(editor: TextEditor): void {
    this._dispatcher.dispatch({
      actionType: BuckToolbarActions.ActionType.UPDATE_PROJECT,
      editor,
    });
  }

  updateBuildTarget(buildTarget: string): void {
    this._dispatcher.dispatch({
      actionType: BuckToolbarActions.ActionType.UPDATE_BUILD_TARGET,
      buildTarget,
    });
  }

  updateSimulator(simulator: string): void {
    this._dispatcher.dispatch({
      actionType: BuckToolbarActions.ActionType.UPDATE_SIMULATOR,
      simulator,
    });
  }

  build(): void {
    this._dispatcher.dispatch({actionType: BuckToolbarActions.ActionType.BUILD});
  }

  run(): void {
    this._dispatcher.dispatch({actionType: BuckToolbarActions.ActionType.RUN});
  }

  debug(): void {
    this._dispatcher.dispatch({actionType: BuckToolbarActions.ActionType.DEBUG});
  }
}

BuckToolbarActions.ActionType = {
  UPDATE_PROJECT: 'UPDATE_PROJECT',
  UPDATE_BUILD_TARGET: 'UPDATE_BUILD_TARGET',
  UPDATE_SIMULATOR: 'UPDATE_SIMULATOR',
  BUILD: 'BUILD',
  RUN: 'RUN',
  DEBUG: 'DEBUG',
};

module.exports = BuckToolbarActions;
