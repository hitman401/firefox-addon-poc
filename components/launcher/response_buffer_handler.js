var Handler = function(onResponseCallback) {
  var bufferQueue = [];
  var processing = false;
  var expectedLength = 0;
  var response = [];
  var responseCallback = onResponseCallback || function() {/* no-op */};
  var readyToReadResponse = true;

  var addToNextBuffer = function(buffer) {
    if (bufferQueue.length === 0) {
      bufferQueue[0] = [];
    }
    bufferQueue[0] = buffer.concat(bufferQueue[0]);
  };

  var reset = function (buff) {
    var lengthBuff = buff.splice(0, 8);
    var uintArray = new Uint8Array(lengthBuff);
    var view = new DataView(uintArray.buffer);
    expectedLength = view.getUint32(0, true);
    response = [];
    if (buff.length > 0) {
      addToNextBuffer(buff);
    }
  };

  var read = function(buff) {
    if (buff.length > expectedLength) {
      addToNextBuffer(buff.splice(expectedLength));
    }
    expectedLength -= buff.length;
    response = response.concat(buff);
    return expectedLength <= 0;
  };

  var run = function() {
    try {
      while (bufferQueue.length !== 0) {
        var buff;
        if (bufferQueue[0].length < 8 && readyToReadResponse && bufferQueue.length === 1) {
          continue;
        }
        buff = bufferQueue.splice(0, 1)[0];
        if (readyToReadResponse) {
          readyToReadResponse = false;
          reset(buff);
        } else if (read(buff)) {
          responseCallback(response);
          readyToReadResponse = true;
        }
      }
    } catch(e) {
      console.log(e);
    }
    processing = false;
  };

  this.addBuffer = function(buff) {
    bufferQueue.push(buff);
    if (!processing) {
      processing = true;
      run();
    }
  };

  return this;
};

exports.createInstance = function(onResponseCallback) {
  return new Handler(onResponseCallback);
};