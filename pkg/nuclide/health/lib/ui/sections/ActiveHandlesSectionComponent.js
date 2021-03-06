'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var React = require('react-for-atom');
var path = require('path');

class ActiveHandlesSectionComponent extends React.Component {

  // Returns a list of handles which are not children of others (i.e. sockets as process pipes).
  static getTopLevelHandles(handles: Array<Object>): Set<Object> {
    var topLevelHandles: Set<Object> = new Set();
    var seen: Set<Object> = new Set();
    handles.forEach(handle => {
      if (seen.has(handle)) {
        return;
      }
      seen.add(handle);
      topLevelHandles.add(handle);
      if (handle.constructor.name === 'ChildProcess') {
        seen.add(handle);
        ['stdin', 'stdout', 'stderr', '_channel'].forEach(pipe => {
          if (handle[pipe]) {
            seen.add(handle[pipe]);
          }
        });
      }
    });
    return topLevelHandles;
  }

  render(): ReactElement {
    if (!this.props.activeHandleObjects || this.props.activeHandleObjects.length === 0) {
      return <div />;
    }

    var handlesByType = {};
    ActiveHandlesSectionComponent.getTopLevelHandles(this.props.activeHandleObjects).forEach(
      handle => {
        var type = handle.constructor.name.toLowerCase();
        if (type !== 'childprocess' && type !== 'tlssocket') {
          type = 'other';
        }
        if (!handlesByType[type]) {
          handlesByType[type] = [];
        }
        handlesByType[type].push(handle);
      }
    );

    var HandlesTableComponent = require('./HandlesTableComponent');
    return (
      <div>
        <HandlesTableComponent
          key={1}
          title="Processes"
          handles={handlesByType['childprocess']}
          keyed={process => process.pid}
          columns={[{
            title: 'Name',
            value: process => path.basename(process.spawnfile),
          }, {
            title: 'In',
            value: process => process.stdin && process.stdin.bytesWritten,
          }, {
            title: 'Out',
            value: process => process.stdout && process.stdout.bytesRead,
          }, {
            title: 'Err',
            value: process => process.stderr && process.stderr.bytesRead,
          }]}
        />
        <HandlesTableComponent
          key={2}
          title="TLS Sockets"
          handles={handlesByType['tlssocket']}
          keyed={socket => socket.localPort}
          columns={[{
            title: 'Host',
            value: socket => socket._host || socket.remoteAddress,
          }, {
            title: 'Read',
            value: socket => socket.bytesRead,
          }, {
            title: 'Written',
            value: socket => socket.bytesWritten,
          }]}
        />
        <HandlesTableComponent
          key={3}
          title="Other handles"
          handles={handlesByType['other']}
          keyed={(handle, h) => h}
          columns={[{
            title: 'Type',
            value: handle => handle.constructor.name,
          }]}
        />
      </div>
    );
  }
}

ActiveHandlesSectionComponent.propTypes = {
  activeHandleObjects: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
};

module.exports = ActiveHandlesSectionComponent;
