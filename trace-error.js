var CallSite = require('./call-site');

var TraceError = {
	constructor: function(error){
		this.error = error;
		this.name = error.name;
		this.message = error.message;
		this.stack = error.stack;
		this.callSites = CallSite.parseStack(error.stack);
	},

	toString: function(){
		var string = '';

		if( this.source ){
			string+= '\n';
			string+= this.source;
		}

		string+= this.error;
		string+= this.callSites.map(function(callSite){
			return '\n\tat ' + String(callSite);
		}).join('');

		return string;
	}
};

TraceError.constructor.prototype = TraceError;
TraceError = TraceError.constructor;

module.exports = TraceError;