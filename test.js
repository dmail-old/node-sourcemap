var CallSite = require('./call-site');

function exec(code){
	eval(code);
}

var foo = {
	exec: function(code){
		eval(code);
	}
};

var code1 = '\ncoucou;';
var code2 = '\ncoucou;\n//# sourceURL=foo.js';
var code3 = '\neval("\ncoucou");';
var code4 = '\neval("throw new Error();//# sourceURL=bar.js");';

try{
	foo.exec(code1);
}
catch(e){
	console.log(e.stack);
	console.log(CallSite.parseError(e));
}

