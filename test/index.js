var assert = require('assert');
var sourceMap = require('../index.js');

var error = new Error();

sourceMap.transformError(error);

console.log(error.stack);
