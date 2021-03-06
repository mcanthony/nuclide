'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {TextEditor} = require('atom');

class ReadOnlyTextEditor extends TextEditor {

  constructor(props: Object) {
    super(props);

    // Cancel insert events to prevent typing in the text editor and disallow editing (read-only).
    this.onWillInsertText(event => {
      event.cancel();
    });
  }

  // Make pasting in the text editor a no-op to disallow editing (read-only).
  pasteText(): void {}

  // Make delete key presses in the text editor a no-op to disallow editing (read-only).
  delete(): void {}

  // Make backspace key presses in the text editor a no-op to disallow editing (read-only).
  backspace(): void {
  }
}

module.exports = ReadOnlyTextEditor;
