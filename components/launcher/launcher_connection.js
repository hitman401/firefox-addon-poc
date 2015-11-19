var LauncherConnection = function (host, port, listener) {
  const {Cc, Ci, Cu, ChromeWorker} = require('chrome');
  const PR_UINT32_MAX = 0xffffffff;
  var transportService =
      Cc['@mozilla.org/network/socket-transport-service;1']
          .getService(Ci.nsISocketTransportService);
  var threadManager = Cc['@mozilla.org/thread-manager;1'].getService();
  var socket;
  try {
    socket = transportService.createTransport(null, 0,host, port, null);
  } catch(e) {
    dump(e);
    listener(e.message);
  }

  var utf8Converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
      .createInstance(Ci.nsIScriptableUnicodeConverter);
  utf8Converter.charset = 'UTF-8';

  socket.setTimeout(1, PR_UINT32_MAX);
  var outStream = socket.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);
  var inputStream = socket.openInputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);

  var binOutstream = Cc['@mozilla.org/binaryoutputstream;1']
      .createInstance(Ci.nsIBinaryOutputStream);
  binOutstream.setOutputStream(outStream);

  var reader = {
    onInputStreamReady: function(inp) {
      inp.asyncWait({
        onInputStreamReady: function(aStream) {
          try {
            var pump = Cc['@mozilla.org/network/input-stream-pump;1']
                .createInstance(Ci.nsIInputStreamPump);
            pump.init(aStream, -1, -1, 1, PR_UINT32_MAX, false);

            pump.asyncRead({
              initStream: function(inStream) {
                this.readableStream = Cc['@mozilla.org/binaryinputstream;1'].createInstance(Ci.nsIBinaryInputStream);
                this.readableStream.setInputStream(inStream);
              },
              onResponse: function(response) {
                listener(null, response);
              },
              onStartRequest: function () {
                var responseBuffer = require('./response_buffer_handler.js');
                this.readableStream = null;
                this.responseHandler = responseBuffer.createInstance(this.onResponse);
              },
              onDataAvailable: function (req, ctx, stream, o, count) {
                console.log('DATA AVAILABLE');
                if (!this.readableStream) {
                  this.initStream(stream);
                }
                this.responseHandler.addBuffer(this.readableStream.readByteArray(count));
              },
              onStopRequest: function () {
                this.readableStream.close();
              }
            }, null);
          } catch(e) {
            console.log(e);
          }
        }
      }, 0, 0, null);
    },
    onStopListening: function(a, status) {
      console.log('Connection closed');
      listener('Connection closed');
    }
  };

  inputStream.asyncWait(reader, 0, 0, threadManager.mainThread);

  this.send = function(msg) {
    var aBuff = new ArrayBuffer(8);
    var view = new DataView(aBuff);
    if (typeof(msg) === 'string') {
      msg = utf8Converter.ConvertToUnicode(msg);
      msg = utf8Converter.convertToByteArray(msg);
    }
    view.setUint32(0, msg.length, true);
    msg = Array.prototype.slice.call(new Uint8Array(view.buffer)).concat(msg);
    binOutstream.writeByteArray(msg, msg.length);
  };

  this.setListener = function(newListener) {
    listener = newListener;
  };
  return this;
};

exports.connect = LauncherConnection;
