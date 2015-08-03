var fs = require('fs');
var CallSite = require('./call-site');

function transformCallSites(callSites, transformer){
	callSites.forEach(transformer);
}

function createStackFromCallSites(callSites){
	return callSites.map(function(callSite){
		return '\n\tat ' + String(callSite);
	}).join('');
}

function toString(){
	var string = '';
	var fileName = this.fileName;

	// Format the line from the original source code like node does
	if( fileName ){
		string+= '\n';
		string+= fileName;

		if( this.lineNumber ){
			string+= ':' + this.lineNumber;
			string+= '\n';

			var filePath;
			if( fileName.indexOf('file:///') === 0 ){
				filePath = fileName.slice('file:///'.length);
			}
			else{
				filePath = fileName;
			}

			if( fs.existsSync(filePath) ){
				var code = fs.readFileSync(filePath, 'utf8');
				var lineSource = code.split(/(?:\r\n|\r|\n)/)[this.lineNumber - 1];

				if( lineSource ){
					string+= lineSource;
					if( this.columnNumber ){
						string+= '\n' + new Array(this.columnNumber).join(' ') + '^';
					}
				}
			}
		}
		else{
			string+= '\n';
		}
	}

	string+= this.name;
	string+= ': ' + this.message;
	string+= this.stack;

	return string;
}

function updatePropertiesFromCallSites(error, callSites){
	var firstCall = callSites[0];

	if( firstCall ){
		error.fileName = firstCall.getFileName();
		error.lineNumber = firstCall.getLineNumber();
		error.columnNumber = firstCall.getColumnNumber();
		error.stack = createStackFromCallSites(callSites);
		error.toString = toString;
	}
}

function mapErrorStack(error, transformer){
	if( error && typeof error.stack === 'string' ){
		var callSites = CallSite.parseStack(error.stack);

		transformCallSites(callSites, transformer);
		updatePropertiesFromCallSites(error, callSites);
	}
	return error;
}

module.exports = mapErrorStack;