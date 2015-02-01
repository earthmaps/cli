// dependencies
var _ = require("underscore"),
	defaults = require("../config/default"),
	fs = require("fs"),
	path = require("path"),
	prompt = require('prompt'),
	Earthmaps = require("earthmaps"),
	util = require('util');

var Exec = function( program ){

	this.program = program;

	// change the config file path
	if (this.program.config) this.updatePath( this.program.config );
	// reset token
	if (this.program.reset) this.resetToken();

	// setup configuration
	this.config = this.initConfig();

	// init lib
	this.api = new Earthmaps( this.config );

}

Exec.prototype = {

	// containers
	config: {},

	setup: function( options ){
		// variables
		var self = this,
			config = {},
			keys = ['email', 'token'];

		// extended setup
		if( options.all ) keys.push('key', 'secret', 'url');

		// Start the prompt
		prompt.start();
		//
		// Get two properties from the user: email and token
		prompt.get(keys, function (err, response) {
			//
			// Log the results
			for( var i in response ){
				// update only keys we need...
				if( keys.indexOf(i) > -1 ) config[i] = response[i];
			}
			// save config back to the file
			self.saveConfig( config );
			return output('Setup complete.');
		});
	},

	initConfig: function(){
		// variables
		var config = {},
			custom = {};
		// get existing setup
		var file = getConfig();
		if( !fs.existsSync(file) ){
			// create config file
			fs.writeFileSync(file, JSON.stringify( config ));
		} else {
			// load existing values
			custom = JSON.parse( fs.readFileSync(file, "utf-8") );
		}
		// extend defaults
		config = _.extend({}, defaults, custom);

		return config;
	},

	initAuth: function( callback ){
		var self = this,
			oauth = this.config.oauth;
		callback = callback || function(){}; // is this needed?
		// check existing token
		if( oauth && oauth.access_token ){
			// - check expiry date
			var now = (new Date()).getTime();
			var hour = 3600000;
			if( oauth.expires < now - hour ) return self.getToken( callback ); // expire one hour earlier...
			// - check against remote ( in intervals )
			if( oauth.updated > now - hour ) return callback();
			self.api.read({ name : "user" }, function(err, result){
				// exit now
				if( err ) return output("The remote hang up - please try again later");
				// get a new token if no results
				if( !result || result.error ) return self.getToken( callback );
			});
		} else {
			// get token
			this.getToken( callback );
		}

	},

	//
	get: function( params ){
		var self = this;
		// use async module?
		// get token
		this.initAuth(function(){
			// add token to the params
			params.token = self.config.oauth.access_token || false;
			if( !params.token ) return output("No valid token"); // re-initialize?
			// then ask for specific data
			self.api.read( params, function(err, result){
				if( err ) return output( err );
				//output data
				output( result );
			});
		});

	},

	// API

	user: function( id, options ){
		var params = {};
		if( id ) params.id = id ;

		// read the product collection for the current user: /user
		params.name = "user";

		if( options.subscriptions ) params.type = "subscriptions";
		if( options.products ) params.type = "products";

		this.get( params );
	},
/*
	product: function( id, options ){
		var params = {};
		if( id ) params.id = id ;

		// read the product collection for the current user: /products
		params.name = ( options.list ) ? "products" : "product";

		if( options.providers ) params.type = "providers";

		this.get( params );
	},

	provider: function( id, options ){
		var params = {};
		if( id ) params.id = id ;

		// read the product collection for the current user: /providers
		params.name = ( options.list ) ? "providers" : "provider";

		this.get( params );
	},
*/
	saveConfig: function ( config ){
		// load existing values
		var file = getConfig();
		var input = JSON.parse( fs.readFileSync(file, "utf-8") );
		var output = _.extend({}, input, config);
		// save file
		fs.writeFileSync(file, JSON.stringify(output), 0);
		// update loaded config
		this.config = _.extend({}, this.config, config);
	},

	updatePath: function ( config ){
		// get path location
		var file = path.resolve( __dirname, '../config/path');
		// save file
		fs.writeFileSync(file, config, 0);
	},

	getToken: function( callback ){
		var self = this;
		// make sure credentials exist
		if( !this.config.email || !this.config.token ) return output("Credentials not available - Please run setup: $ onscribe setup");
		//
		this.api.password({ username: this.config.email, password: this.config.token }, function( err, result ){
			if( err ) return output("Error authenticating", err);
			if( result.error ) return output("There was an error obtaining your token");
			var now = (new Date()).getTime();
			result.updated = now;
			// normalize expiry
			if( result.expires_in ){
				result.expires = now + result.expires_in;
			}
			// save token
			self.saveConfig({ oauth: result });
			callback();
		});
	},

	// in case we want to reset the token
	resetToken: function(){
		this.saveConfig({ oauth: false });
	}

}

// Helpers
function output( data ){
	// convert string (if needed)
	var str = (typeof data == "string") ? data : JSON.stringify(obj);
	return console.log( str );
	//return console.log( util.inspect(obj, false, null) );
}

function homeDir() {
	return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function getConfig(){
	var config = path.join(__dirname, "../", "config/path");
	// load the config file
	var file = fs.readFileSync(config, "utf-8");
	var home = homeDir( file );
	// FIX : replace home dir
	file = file.replace("~", home);
	return file;
}


module.exports = function( program ){

	return new Exec( program );

}
