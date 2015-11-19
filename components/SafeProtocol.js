var { Class } = require('sdk/core/heritage');
const { CC, Cc, Ci, Cu, Cr } = require('chrome');
var { Unknown, Factory } = require('sdk/platform/xpcom');
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
const SCHEME = "safe";

var contractId = "@mozilla.org/network/protocol;1?name=" + SCHEME;


var PipeChannel = function(URI) {
  this.pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
  this.pipe.init(true, true, 10, 10, null); // Files upto 1 GB can be supported
  this.inputStreamChannel = Cc["@mozilla.org/network/input-stream-channel;1"].createInstance(Ci.nsIInputStreamChannel);
  this.inputStreamChannel.setURI(URI);
  this.inputStreamChannel.contentStream = this.pipe.inputStream;
  this.request = this.inputStreamChannel.QueryInterface(Ci.nsIRequest);
  this.channel = this.inputStreamChannel.QueryInterface(Ci.nsIChannel);
};

PipeChannel.prototype = {
  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIChannel) || iid.equals(Ci.nsIRequest) || iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_NOINTERFACE;
  },

  asyncOpen: function(listener, context) {
    console.log('INTERCEPTED #################');
  },

  open: function() {
    return this.channel.open();
  },

  close: function() {
    this.pipe.outputStream.close();
  }
};


var SafeProtocol = Class({
  extends: Unknown,
  get wrappedJSObject() this,
  classDescription: "Safe Protocol Handler",
  contractID: contractId,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler]),
  scheme: SCHEME,
  defaultPort: -1,
  allowPort: function(port, scheme) {
    return false;
  },
  protocolFlags: Ci.nsIProtocolHandler.URI_NOAUTH | Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,
  newURI: function(aSpec, aOriginCharset, aBaseURI) {
    var uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    return uri;
  },
  newChannel: function(aURI) {
    return new PipeChannel(aURI).QueryInterface(Ci.nsIChannel);
  }
});


var factory = Factory({
  contract: contractId,
  Component: SafeProtocol
});

