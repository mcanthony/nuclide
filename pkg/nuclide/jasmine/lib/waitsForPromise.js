'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
var invariant = require('assert');

/*eslint-disable no-unused-vars*/
type WaitsForPromiseOptions = {
  shouldReject?: boolean;
  timeout?: number;
}
/*eslint-enable no-unused-vars*/

function waitsForPromise(...args: Array<WaitsForPromiseOptions | () => Promise<mixed>>): void {
  if (args.length > 1) {
    var {shouldReject, timeout} = args[0];
  } else {
    var [shouldReject, timeout] = [false, 0];
  }

  var finished = false;

  runs(() => {
    var fn = args[args.length - 1];
    invariant(typeof fn === 'function');
    var promise = fn();
    if (shouldReject) {
      promise.then(() => {
        jasmine.getEnv().currentSpec.fail(
          'Expected promise to be rejected, but it was resolved');
      }, () => {
        // Do nothing, it's expected.
      }).then(() => {
        finished = true;
      });
    } else {
      promise.then(() => {
        // Do nothing, it's expected.
      }, (error) => {
        var text = error ? (error.stack || error.toString()) : 'undefined';
        jasmine.getEnv().currentSpec.fail(
          `Expected promise to be resolved, but it was rejected with ${text}`);
      }).then(() => {
        finished = true;
      });
    }
  });

  waitsFor(timeout, () => finished);
}

module.exports = waitsForPromise;
