var { Class } = require('sdk/core/heritage');
var { Unknown, Factory } = require('sdk/platform/xpcom');
var { Cc, Ci, Cu } = require('chrome');
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var contractId = '@mozilla.org/commandlinehandler/general-startup;1?type=launcher';

// Define a component
var CommandLineHandler = Class({
  extends: Unknown,
  get wrappedJSObject() this,
  contractID: contractId,
  classDescription: "webAppFinder",
  interfaces: ['nsiCommandLineHandler' ],
  QueryInterface : function dch_QI(iid) {
    if (!iid.equals(nsISupports) &&
        !iid.equals(nsICommandLineHandler))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },
  _xpcom_categories: [{
    category: "command-line-handler",
    // category names are sorted alphabetically. Typical command-line handlers use a
    // category that begins with the letter "m".
    entry: "m-launcher"
  }],
  helpInfo : "  -launcher               Open My Application\n",
  handle : function (cmdLine) {
    console.log('good so far'); // Doesn't actually reach here
    //try {
    //  var fileStr = cmdLine.handleFlagWithParam("webappfind", false);
    //  if (fileStr) {
    //    console.log('made it');
    //  }
    //}
    //catch (e) {
    //  Cu.reportError("incorrect parameter passed to -webappfind on the command line.");
    //}
    //
    //if (cmdLine.handleFlag("webappfind", false)) { // no argument
    //  cmdLine.preventDefault = true;
    //  throw 'A valid ID must be provided to webappfind';
    //}
  }
});

// Create and register the factory
var factory = Factory({
  contract: contractId,
  Component: CommandLineHandler
});

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([CommandLineHandler]);

//var wrapper = Cc[contractId].createInstance(Ci.nsISupports);
//var helloWorld = wrapper.wrappedJSObject;
//console.log(helloWorld.hello());