/**
 * Manages the request and maps the responses back to the callbacks.
 * Request manager on initialisation sends back its own instance as the success parameter of notifierCallback.
 * Any IO error (Socket connection) with launcher is also indicated via the error parameter of notifierCallback.
 * @param host - Host ip received from launcher
 * @param portNumber - portNumber received from launcher
 * @param launcherString - String received from launcher
 * @param notifierCallback - Invoked on successful initialisation or on IO error
 * @constructor
 */
var RequestManager = function(host, portNumber, launcherString, notifierCallback) {
  var connectionManager = require('./launcher_connection');
  var nacl = require('./nacl-fast');
  var base64 = require('sdk/base64');
  const { Cc, Ci } = require('chrome');
  var launcherConnection;
  var utf8Converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
      .createInstance(Ci.nsIScriptableUnicodeConverter);
  utf8Converter.charset = 'UTF-8';

  var encryptionKey;
  var encryptionNonce;
  var callbackPool = {};

  /**
   * Utility function to convert TypedArray to Array
   * @param map
   * @returns {Array}
   */
  var convertToArray = function(typedArray) {
    return Array.prototype.slice.call(typedArray);
  };

  /**
   * Holder for managing the Keys used during the Handshake with launcher
   * @type {{nonce: null, secretKey: null, publicKey: null, init: Function}}
   */
  var HandshakeKeys = {
    nonce: null,
    secretKey: null,
    publicKey: null,
    init: function() {
      try {
        var keyPair = nacl.box.keyPair();
        this.publicKey = keyPair.publicKey;
        this.secretKey = keyPair.secretKey;
        this.nonce = nacl.randomBytes(nacl.lowlevel.crypto_box_NONCEBYTES);
      } catch(e) {
        notifierCallback(new Error('Failed to initialise HandshakeKeys - NACL error'));
      }
    }
  };

  var arrayToBase64 = function(array) {
    var i, s = [], len = array.length;
    for (i = 0; i < len; i++) s.push(String.fromCharCode(array[i]));
    return base64.encode(s.join(''));
  };

  function convertBase64ToUint8Array(base64String) {
    var raw = base64.decode(base64String);
    var rawLength = raw.length;
    var array = new Uint8Array(new ArrayBuffer(rawLength));
    for(var i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  }

  /**
   * Data is hashed (SHA512) and converted as a base64 string.
   * The base64 string serves as ID for identifying the response and associating with their callbacks.
   * Callbacks are added to an Array, to manage multiple requests.
   * @param data
   * @param callback
   */
  var addToCallbackPool = function(data, callback) {
    var id = arrayToBase64(nacl.hash(new Uint8Array(data)));
    if (!callbackPool[id]) {
      callbackPool[id] = [];
    }
    callbackPool[id].push(callback);
  };

  /**
   * Encrypts the data with the Symmetric Key and nonce received from the launcher
   * @param data {Array}
   * @returns {Array}
   */
  var encrypt = function(data) {
    return convertToArray(nacl.secretbox(new Uint8Array(data), encryptionNonce, encryptionKey));
  };

  /**
   * Decrypts the data with the Symmetric Key and nonce received from the launcher
   * @param data
   * @returns {String}
   */
  var decrypt = function(data) {
    var ct = new Uint8Array(data);
    var decryptedData = convertToArray(nacl.secretbox.open(ct, encryptionNonce, encryptionKey));
    return utf8Converter.convertFromByteArray(decryptedData, decryptedData.length);
  };

  var onDataReceived = function(err, data) {
    console.log('DATA RECEIVED CALLBACK');
    if (err) {
      console.log('Launcher socket connection closed');
      return notifierCallback('Launcher Connection Error');
    }
    var response;
    try {
      response = JSON.parse(decrypt(data));
      console.log('Decrypted Response :' + JSON.stringify(response));
      if (!callbackPool.hasOwnProperty(response.id)) {
        console.log('Callback not found for response in RequestManager');
        return;
      }
      console.log('Invoking Callbacks');
      var callbacks = callbackPool[response.id];
      for (var i in callbacks) {
        var error = (response.error.code === 0) ? null : response.error;
        callbacks[i]({ 'error': error }, response.data);
      }
      delete callbackPool[response.id];
    } catch(ex) {
      console.log(ex.message);
    }
  };

  /**
   * Invoked after the Handshake response is recieved from the launcher.
   * The response is parsed and the result is notified via the notifierCallback.
   * if the response received is success, then the Symmetric key and nonce is decrypted from the response.
   * @param handshakeResponse
   */
  var onHandShake = function(err, handshakeResponse) {
    if (err) {
      return notifierCallback(err);
    }
    handshakeResponse = utf8Converter.convertFromByteArray(handshakeResponse, handshakeResponse.length);
    console.log('Launcher responded for handshake request');
    console.log('Handshake response - ' + handshakeResponse.toString());
    handshakeResponse = JSON.parse(handshakeResponse.toString());
    if (handshakeResponse.error) {
      console.log('handshake failed - ' + handshakeResponse.error.description);
      console.log(handshakeResponse.error);
      notifierCallback('Handshake failed - ' + handshakeResponse.error.description +
      '(' + handshakeResponse.error.code + ')');
      return;
    }
    var launcherPublicKey = convertBase64ToUint8Array((handshakeResponse.data.launcher_public_key));
    var decryptedSymmKey;
    try {
      var enc_msg = convertBase64ToUint8Array(handshakeResponse.data.encrypted_symm_key);
      decryptedSymmKey = nacl.box.open(enc_msg, new Uint8Array(HandshakeKeys.nonce),
          new Uint8Array(launcherPublicKey), HandshakeKeys.secretKey);
    } catch(e) {
      console.log('SymmetricKey Decryption failed', e.message);
      return notifierCallback('SymmetricKey Decryption failed');
    }
    encryptionNonce = decryptedSymmKey.subarray(0, nacl.lowlevel.crypto_secretbox_NONCEBYTES);
    encryptionKey = decryptedSymmKey.subarray(nacl.lowlevel.crypto_secretbox_NONCEBYTES);
    launcherConnection.setListener(onDataReceived);
    notifierCallback(null);
  };

  /**
   * Instantiates the Handshake request
   */
  var handshake = function() {
    console.log('Initiating Handshake with Launcher');
    var request = {
      "endpoint": "safe-api/v1.0/handshake/authenticate-app",
      "data": {
        "launcher_string": launcherString,
        "asymm_nonce": arrayToBase64(HandshakeKeys.nonce),
        "asymm_pub_key": arrayToBase64(HandshakeKeys.publicKey)
      }
    };
    console.log('Sending Request : ' + JSON.stringify(request));
    launcherConnection.send(JSON.stringify(request));
  };

  /**
   * Invoked to send the Request to the Launcher
   * @param request - Object
   * @param callback
   */
  this.send = function(request, callback) {
    request = JSON.stringify(request);
    console.log('Request ::' + request);
    var encryptedRequest = encrypt(utf8Converter.convertToByteArray(request));
    addToCallbackPool(encryptedRequest, callback);
    launcherConnection.send(encryptedRequest);
    console.log('Request SENT');
  };

  HandshakeKeys.init();
  console.log('Trying to connect with launcher');
  launcherConnection = new connectionManager.connect(host, portNumber, onHandShake);
  handshake();
  return this;
};

exports.init = function(host, portNumber, launcherstring, callback) {
  return new RequestManager(host, portNumber, launcherstring, callback);
};
