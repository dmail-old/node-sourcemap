var SourceMapConsumer = require('source-map').SourceMapConsumer;
var path = require('path');
var fs = require('fs');
var url = require('url');
var StackTrace = require('node-stacktrace');

// Maps a file path to a string containing the file contents
var fileContentsCache = {};

// Maps a file path to a source map for that file
var sourceMapCache = {};

// Regex for detecting source maps
var reSourceMap = /^data:application\/json[^,]+base64,/;

var readFile;

function retrieveFile(path){
	// Trim the path to make sure there is no extra whitespace.
	path = path.trim();
	if( path in fileContentsCache ){
		return fileContentsCache[path];
	}

	var contents;

	contents = readFile(path);

	if( !contents ){
		try{
			contents = fs.readFileSync(path, 'utf8');
		}
		catch (e) {
			contents = null;
		}
	}

	return fileContentsCache[path] = contents;
}

function supportRelativeURL(file, base){
	return file ? url.resolve(file, base) : base;
}

function retrieveSourceMapURL(source){
	var fileData;

	// Get the URL of the source map
	fileData = retrieveFile(source);
	//        //# sourceMappingURL=foo.js.map                       /*# sourceMappingURL=foo.js.map */
	var re = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/)[ \t]*$)/mg;
	// Keep executing the search to find the *last* sourceMappingURL to avoid
	// picking up sourceMappingURLs from comments, strings, etc.
	var lastMatch, match;
	while( match = re.exec(fileData) ){
		lastMatch = match;
	}

	return lastMatch ? lastMatch[1] : null;
}

// Can be overridden by the retrieveSourceMap option to install. Takes a
// generated source filename; returns a {map, optional url} object, or null if
// there is no source map.  The map field may be either a string or the parsed
// JSON object (ie, it must be a valid argument to the SourceMapConsumer
// constructor).
function retrieveSourceMap(source){
	var sourceMappingURL = retrieveSourceMapURL(source);
	if( !sourceMappingURL ) return null;

	// Read the contents of the source map
	var sourceMapData;
	if( reSourceMap.test(sourceMappingURL) ){
		// Support source map URL as a data url
		var rawData = sourceMappingURL.slice(sourceMappingURL.indexOf(',') + 1);
		sourceMapData = new Buffer(rawData, "base64").toString();
		sourceMappingURL = null;
	}
	else{
		// Support source map URLs relative to the source URL
		sourceMappingURL = supportRelativeURL(source, sourceMappingURL);
		sourceMapData = retrieveFile(sourceMappingURL);
	}

	if( !sourceMapData ){
		return null;
	}

	return {
		url: sourceMappingURL,
		map: sourceMapData
	};
}

function mapSourcePosition(position){
	var sourceMap = sourceMapCache[position.source];
	if( !sourceMap ){
		// Call the (overrideable) retrieveSourceMap function to get the source map.
		var urlAndMap = retrieveSourceMap(position.source);

		if( urlAndMap ){
			sourceMap = sourceMapCache[position.source] = {
				url: urlAndMap.url,
				map: new SourceMapConsumer(urlAndMap.map)
			};

			// Load all sources stored inline with the source map into the file cache
			// to pretend like they are already loaded. They may not exist on disk.
			if( sourceMap.map.sourcesContent ){
				sourceMap.map.sources.forEach(function(source, i) {
					var contents = sourceMap.map.sourcesContent[i];
					if( contents ){
						var url = supportRelativeURL(sourceMap.url, source);
						fileContentsCache[url] = contents;
					}
				});
			}
		}
		else{
			sourceMap = sourceMapCache[position.source] = {
				url: null,
				map: null
			};
		}
	}

	// Resolve the source URL relative to the URL of the source map
	if( sourceMap && sourceMap.map ){
		var originalPosition = sourceMap.map.originalPositionFor(position);

		// Only return the original position if a matching line was found. If no
		// matching line is found then we return position instead, which will cause
		// the stack trace to print the path and line for the compiled file. It is
		// better to give a precise location in the compiled file than a vague
		// location in the original file.
		if( originalPosition.source !== null ){
			originalPosition.source = supportRelativeURL(sourceMap.url || position.source, originalPosition.source);
			return originalPosition;
		}
	}

	return position;
}

function mapCallSite(callSite, index, callSites){
	var source = callSite.getScriptNameOrSourceURL() || callSite.getFileName();

	if( source ){
		var line = callSite.getLineNumber();
		var column = callSite.getColumnNumber() - 1;

		// Fix position in Node where some (internal) code is prepended.
		// See https://github.com/evanw/node-source-map-support/issues/36
		var fromModule = typeof process !== 'undefined' && callSites.length && callSites[callSites.length - 1].getFileName() === 'module.js';
		if( fromModule && line === 1 ) {
			column-= 63;
		}

		var position = mapSourcePosition({
			source: source,
			line: line,
			column: column
		});

		callSite.source = position.source;
		callSite.lineNumber = position.line;
		callSite.columnNumber = position.column + 1;
	}

	/*
	if( callSite.isEval() ){
		console.log('handling isEval calls');

		var evalOrigin = callSite.getEvalOrigin();
		var evalSsource = evalOrigin.getFileName() || evalOrigin.getScriptNameOrSourceURL();
		var evalLine = evalOrigin.getLineNumber();
		var evalColumn = evalOrigin.getColumnNumber() - 1;

		var evalPosition =  mapSourcePosition({
			source: source,
			line: evalSsource,
			column: evalColumn
		});

		callSite.evalFileName = evalPosition.source;
		callSite.evalLineNumber = evalPosition.line;
		callSite.evalColumnNumber = evalPosition.column + 1;
	}
	*/

	// Code called using eval() needs special handling
	/*
	if( callSite.isEval() ){
		var evalOrigin = callSite.getEvalOrigin();

		if( evalOrigin ){
			mapCallSite(evalOrigin);
		}
	}
	*/

	//console.log('mapping', source, 'into', callSite.source);
}

var installed = false;

module.exports = {
	StackTrace: StackTrace,

	install: function(readSource){
		if( installed ){
			throw new Error('sourcemap already installed');
		}
		else{
			installed = true;

			readFile = readSource || function(){};

			StackTrace.setTransformer(mapCallSite);
		}
	}
};
