var CallSite = {
	source: null,
	fileName: null,
	functionName: null,
	fromNative: false,
	fromConstructor: false,
	fromToplevel: false,
	fromEval: false,
	line: null,
	column: null,
	typeName: null,
	sourceURL: null,

	evalFileName: null,
	evalLineNumber: null,
	evalColumnNumber: null,

	constructor: function(properties){
		properties = properties || {};

		for( var property in properties ){
			this[property] = properties[property];
		}
	},

	isEval: function(){
		return Boolean(this.fromEval);
	},

	isNative: function(){
		return Boolean(this.fromNative);
	},

	isConstructor: function(){
		return Boolean(this.fromConstructor);
	},

	isToplevel: function(){
		return Boolean(this.fromToplevel);
	},

	// returns callsite corresponding to the eval call origin
	getEvalOrigin: function(){
		return new this({
			fileName: this.evalFileName,
			line: this.evalLineNumber,
			column: this.evalColumnNumber
		});
	},

	getFileName: function(){
		return this.source ? this.source : this.fileName;
	},

	getFunctionName: function(){
		return this.functionName;
	},

	getMethodName: function(){
		return this.getFunctionName();
	},

	getTypeName: function(){
		return this.typeName;
	},

	getLineNumber: function(){
		return this.line;
	},

	getColumnNumber: function(){
		return this.column;
	},

	// Most call sites will return the source file from getFileName(), but code
  	// passed to eval() ending in "//# sourceURL=..." will return the source file
  	// from getScriptNameOrSourceURL() instead
	getScriptNameOrSourceURL: function(){
		return this.sourceURL ? this.sourceURL : this.getFileName();
	},

	// This is copied almost verbatim from the V8 source code at
	// https://code.google.com/p/v8/source/browse/trunk/src/messages.js. The
	// implementation of wrapCallSite() used to just forward to the actual source
	// code of CallSite.prototype.toString but unfortunately a new release of V8
	// did something to the prototype chain and broke the shim. The only fix I
	// could find was copy/paste.
	toString: function(){
		var fileName, fileLocation = '';

		if( this.isNative() ){
			fileLocation = 'native';
		}
		else{
			fileName = this.getScriptNameOrSourceURL();
			if( !fileName && this.isEval() ){
				fileLocation = this.getEvalOrigin();
				fileLocation+= ", "; // Expecting source position to follow.
			}

			if( fileName ){
				fileLocation+= fileName;
    		}
    		else{
				// Source code does not originate from a file and is not native, but we
				// can still get the source position inside the source string, e.g. in
				// an eval string.
				fileLocation+= "<anonymous>";
			}

			var lineNumber = this.getLineNumber();
			if( lineNumber != null ){
				fileLocation+= ":" + lineNumber;
				var columnNumber = this.getColumnNumber();
				if( columnNumber ){
					fileLocation += ":" + columnNumber;
				}
			}
		}

		var line = '';
		var functionName = this.getFunctionName();
		var addSuffix = true;
		var isConstructor = this.isConstructor();
		var isMethodCall = !(this.isToplevel() || isConstructor);
		if( isMethodCall ){
			var typeName = this.getTypeName();
			var methodName = this.getMethodName();
			if( functionName ){
				if( typeName && functionName.indexOf(typeName) !== 0 ){
					line += typeName + ".";
				}
				line+= functionName;
				if( methodName && functionName.indexOf("." + methodName) != functionName.length - methodName.length - 1 ){
					line+= " [as " + methodName + "]";
				}
			}
			else{
				line += typeName + "." + (methodName || "<anonymous>");
			}
		}
		else if( isConstructor ){
			line+= "new " + (functionName || "<anonymous>");
		}
		else if( functionName ){
			line+= functionName;
		}
		else{
			line+= fileLocation;
			addSuffix = false;
		}
		if( addSuffix ){
			line += " (" + fileLocation + ")";
		}

		return line;
	}
};

CallSite.constructor.prototype = CallSite;
CallSite = CallSite.constructor;

function parseLocation(location){
	var match = location.match(/^(.+):(\d+):(\d+)$/);

	return {
		fileName: match[1],
		line: parseInt(match[2], 10),
		column: parseInt(match[3], 10)
	};
}

function assignLocation(properties, location){
	properties.fileName = location.fileName;
	properties.line = location.line;
	properties.column = location.column;
}

function assignEvalLocation(properties, location){
	properties.evalFileName = location.fileName;
	properties.evalLineNumber = location.line;
	properties.evalColumnNumber = location.column;
}

function mapEvalOrigin(parts){
	var location = parts.location;

	if( location.indexOf('eval at ') === 0 ){
		var evalMatch = location.match(/^eval at ([^ ]+) \((.+)?\)$/);

		parts.name = evalMatch[1];
		parts.location = evalMatch[2];
		mapEvalOrigin(parts);
	}
}

function parseEval(location){
	var parts = {}, match = location.match(/^eval at ([^ ]+) \((.+)?\), (.+)$/);

	parts.name = match[1];
	parts.location = match[2];
	parts.origin = match[3];

	mapEvalOrigin(parts);

	return parts;
}

CallSite.parse = function(line){
	var properties = {};

	if( line.match(/^\s*[-]{4,}$/) ){
		properties.fileName = line;
	}
	else{
		var lineMatch = line.match(/^\s+at\s+(?:([^ ]+)\s+)?\((.+)?\)$/);
		if( lineMatch ){
			var callNames = lineMatch[1];
			var callLocation = lineMatch[2];

			if( callNames ){
				var names = callNames.match(/(\w+)?(?:\.(.+))?/);

				properties.functionName = callNames;

				properties.methodName = names[2];
				if( properties.methodName ){
					properties.typeName = names[1];
				}
				else{
					properties.typeName = 'Object';
				}
			}

			if( callLocation ){
				// CallLocation examples
				// eval at <anonymous> (C:\Users\Damien\Documents\GitHub\source-ap-node-error\test.js:4:2), <anonymous>:1:1
				// module.js:460:26

				if( callLocation === 'native' ){
					properties.fromNative = true;
				}
				else{
					var location;

					if( callLocation.indexOf('eval at ') === 0 ){
						var evalParts = parseEval(callLocation);
						var evalName = evalParts.name;
						var evalLocation = parseLocation(evalParts.origin);

						location = parseLocation(evalParts.location);

						properties.fromEval = true;
						assignLocation(properties, location);
						assignEvalLocation(properties, evalLocation);
					}
					else if( properties.functionName === 'eval' ){
						location = parseLocation(callLocation);

						assignLocation(properties, location);
						assignEvalLocation(properties, location);
					}
					else{
						location = parseLocation(callLocation);

						assignLocation(properties, location);
					}
				}
			}

			if( properties.functionName === 'eval' ){
				properties.fromEval = true;
			}

			if( properties.methodName === '<anonymous>' ){
				properties.methodName = null;
				properties.functionName = '';
			}
		}
	}

	return new CallSite(properties);
};

CallSite.parseAll = function(lines){
	return lines.map(function(line){
		return CallSite.parse(line);
	}, this).filter(function(callSite){
		return Boolean(callSite);
	});
};

CallSite.parseStack = function(stack){
	return this.parseAll(stack.split('\n').slice(1));
};

CallSite.parseError = function(error){
	return this.parseStack(error.stack);
};

CallSite.stringifyAll = function(callSiteList){
	return callSiteList.map(function(callSite){
		return String(callSite);
	});
};

module.exports = CallSite;