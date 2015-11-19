var callbackPool = [];
var postRequest = function(data, callback) {
  var req = {
    index: callbackPool.length,
    msg: data
  };
  callbackPool.push(callback);
  self.port.emit('send', req);
};

self.port.on('response', function(response) {
  callbackPool[response.index](JSON.stringify(response.msg));
});

var SAFE = createObjectIn(unsafeWindow, {defineAs: 'safeNetwork'});
exportFunction(postRequest, SAFE, {defineAs: 'api'});
