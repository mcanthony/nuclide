'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import NuclideCustomPaneItem from 'nuclide-ui-pane-item';
import ProcessOutputView from './ProcessOutputView';
import React from 'react-for-atom';

import type {NuclideCustomPaneItemOptions} from 'nuclide-ui-pane-item/lib/types';

class ProcessOutputWrapper extends NuclideCustomPaneItem {

  __renderPaneItem(options: NuclideCustomPaneItemOptions): ReactElement {
    return (
      <ProcessOutputView
        processOutputStore={options.initialProps.processOutputStore}
        processOutputHandler={options.initialProps.processOutputHandler}
        processOutputViewTopElement={options.initialProps.processOutputViewTopElement}
      />
    );
  }
}

module.exports = document.registerElement('process-output-wrapper', ProcessOutputWrapper);
