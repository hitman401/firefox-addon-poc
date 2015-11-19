var { Class } = require('sdk/core/heritage');
var { Unknown, Service } = require('sdk/platform/xpcom');
var { Cc, Ci } = require('chrome');

var contractId = '@maidsafe/launcher-service';

var LauncherService = Class({
  extends: Unknown,
  initialize: function() {
    this.running = false;
    this.requestManager = null;
  },
  get wrappedJSObject() this,
  init: function(host, port, launcherString, listener) {
    var instance = this;
    var requestManagerListener = function(err) {
      if (err) {
        return listener(new Error(err));
      }
      instance.running = true;
      listener();
    };
    instance.requestManager = new require('./request_manager').init(host, port, launcherString, requestManagerListener);
  },
  send: function(msg, callback) {
    if (!this.running) {
      callback({
        error: {
          code: 999,
          description: 'Not yet initialised'
        }
      });
    }
    this.requestManager.send(msg, callback);
  },
  isRunning: function() {
    return this.running;
  }
});

// Register the service using the contract ID
var service = Service({
  contract: contractId,
  Component: LauncherService
});
