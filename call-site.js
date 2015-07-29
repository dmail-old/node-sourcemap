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
	evalOrigin: null,
	sourceURL: null,

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

	getEvalOrigin: function(){
		return this.evalOrigin;
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
				fileLocation+= ", ";  // Expecting source position to follow.
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

CallSite.parse = function(line){
	var properties = {}, lineMatch;

	if( line.match(/^\s*[-]{4,}$/) ){
		properties.fileName = line;
	}
	else if( lineMatch = line.match(/at (?:(.+)\s+)?\(?(?:(.+?):(\d+):(\d+)|([^)]+))\)?/) ){
		var object = null;
		var method = null;
		var functionName = null;
		var typeName = null;
		var methodName = null;
		var isNative = lineMatch[5] === 'native';

		if( lineMatch[1] ){
			var methodMatch = lineMatch[1].match(/([^\.]+)(?:\.(.+))?/);
			object = methodMatch[1];
			method = methodMatch[2];
			functionName = lineMatch[1];
			typeName = 'Object';
			properties.fromToplevel = true;
		}

		if( method ){
			typeName = object;
			methodName = method;
		}

		if( method === '<anonymous>' ){
			methodName = null;
			functionName = '';
		}

		properties = {
			fileName: lineMatch[2] || null,
			line: parseInt(lineMatch[3], 10) || null,
			functionName: functionName,
			typeName: typeName,
			methodName: methodName,
			column: parseInt(lineMatch[4], 10) || null,
			'native': isNative,
		};
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