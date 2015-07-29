var CallSite = require('./call-site');

var TraceError = {
	constructor: function(error){
		this.error = error;
		this.callSites = CallSite.parseStack(error.stack);
	},

	toString: function(){
		return this.error + this.callSites.map(function(callSite){
			return '\n\tat ' + String(callSite);
		}).join('');
	}
};

TraceError.constructor.prototype = TraceError;
TraceError = TraceError.constructor;

module.exports = TraceError;