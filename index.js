var self = require('sdk/self');
var tabs = require('sdk/tabs');
var {Cc, Ci} = require('chrome');

require('./components/launcher/launcher_service.js');

var serviceWrapper = Cc['@maidsafe/launcher-service'].getService(Ci.nsISupports);
var launcherService = serviceWrapper.wrappedJSObject;

var initialiseApiWorker = function(apiWorker) {
  apiWorker.port.on('send', function(request) {
    var Response = function(index) {
      this.handle = function(response) {
        apiWorker.port.emit('response', {
          index: index,
          msg: response
        });
      }
    };
    if (!launcherService.isRunning()) {
      return apiWorker.port.emit('response', {
        index: request.index,
        response: {
          errorCode: 999
        }
      });
    }
    launcherService.send(request.msg, new Response(request.index).handle);
  });
};

var initialiseActivationPageWorker = function(activationWorker) {
  activationWorker.port.on('connect', function(request) {
    if (launcherService.isRunning()) {
      return activationWorker.port.emit('connectResponse', {msg: 'Already Connected'});
    }
    launcherService.init(request.host || 'localhost', request.port, request.launcherString, function(err) {
      activationWorker.port.emit('connectResponse', {error: err});
    });
  });
};

require('sdk/ui/button/action').ActionButton({
  id: "safe-protocol",
  label: "MaidSafe",
  icon: {
    "16": "./images/icon-16.png",
    "32": "./images/icon-32.png",
    "64": "./images/icon-64.png"
  },
  onClick: function() {
    tabs.open({
      url: './activation.html',
      onOpen: function(tab) {
        tab.on('ready', function(tab) {
          var activationPageWorker = tab.attach({
            include: './content_script/api.html',
            contentScriptFile: './content_script/activation.js'
          });
          initialiseActivationPageWorker(activationPageWorker);
        });
      }
    });
  }
});

tabs.on('ready', function (tab) {
  if (!launcherService.isRunning()) {
    return;
  }
  var apiWorker = tab.attach({
    contentScriptFile: './content_script/api.js'
  });
  initialiseApiWorker(apiWorker);
});
