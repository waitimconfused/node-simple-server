const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

/**
 * @typedef {object} ServerInitOptions
 * @prop {number} port Port number
 * @prop {?(symbol|symbol[])} flags See `Server.flags`
 * @prop {ServerCustomData} customData
 */

/**
 * @typedef {object} CustomData
 * @prop {"/"|string} rootDirectory See `Server.flags.FILESYSTEM`
 * @prop {http.Server} subdomainServerReference **⚠️ Internal use only ⚠️**
 */

/**
 * @typedef {(request?:http.IncomingMessage,result?:http.ServerResponse<http.IncomingMessage>&{req:http.IncomingMessage})=>void|Promise<void>} ServerCallbackFunction
 */

/**
 * @typedef {"GET"|"HEAD"|"OPTIONS"|"TRACE"|"PUT"|"DELETE"|"POST"|"PATCH"|"CONNECT"} HTTPMethod
 */

class Server {
	port = 1200;

	domain = "localhost";

	/** @type {Object<string, { callback:ServerCallbackFunction, methods?:HTTPMethod[] }>} */
	#endpoints = {};
	/** Returns a list of endpoint paths that have been created */
	getEndpoints() { return Object.keys(this.#endpoints); }

	/** @type {Object<string, Server>} */
	#subdomains = {};
	getSubdomains() { return Object.keys(this.#subdomains); }
	removeAllSubdomains() {
		this.#subdomains = {};
	}

	/** @type {Object<number, ServerCallbackFunction>} */
	#statusHandelers = {};

	/** @type {Object<string, symbol>} See `Server.flags` */
	flags = {};

	/** @type {ServerCustomData} */
	customData = {};

	/** @type {?http.Server} */
	_httpServer;

	/** @type {?Server} Filled in if server is a subdomain (See `Server.flags._SUBDOMAIN`) */
	parentServer;

	get fullDomain() {
		if (this.flags[Server.flags._SUBDOMAIN]) {
			return this.domain+"."+this.parentServer.fullDomain;
		}
		return this.domain + ":" + this.port;
	}

	/**
	 * @param {number|ServerInitOptions} options localhost port number or server options
	 */
	constructor(options) {
		if (typeof options == "number") options = { port: options };
		if (typeof options?.flags == "symbol") options.flags = [options.flags];
		options.port = options?.port ?? 1200;
		options.flags = options?.flags ?? [];
		options.domain = options?.domain ?? "localhost";
		options.customData = options?.customData ?? {};

		this.domain = Object.freeze(options.domain);
		this.port = Object.freeze(options.port);
		this.customData = Object.freeze(options.customData);

		for (let i = 0; i < options.flags.length; i ++) {
			this.flags[options.flags[i]] = true;
		}
		this.flags = Object.freeze(this.flags);

		if (!this.flags[Server.flags._SUBDOMAIN]) { // Is a default server

			this._httpServer = http.createServer((request, result) => {
				this.#processRequest(request, result);
			});

		} else { // Is a custom server (subdomain or fileserver)
			this.parentServer = options.customData["subdomainServerReference"];
			this._httpServer = this.parentServer._httpServer;
			delete this.open;
			delete this.close;
		}

	}

	/**
	 * Opens the server over HTTP
	 * @returns {Promise<null>}
	 */
	open() {
		return new Promise((resolve) => {
			if (!this._httpServer) {
				resolve(null);
				return;
			}
			this._httpServer.listen(this.port, "0.0.0.0", () => {
				console.log(`🌐 Opened server at: ${Server.logStyles.underline}http://${Server.fixedIpAddress}:${this.port}${Server.logStyles.reset}`);
				resolve(null);
			});
			resolve(null);
		})
	}

	/**
	 * Closes the server
	 * @returns {Promise<null>}
	 */
	close() {
		return new Promise((resolve) => {
			if (!this._httpServer) {
				resolve(null);
				return;
			}
			this._httpServer.close(() => {
				console.log(`🌐 Closed server at: ${Server.logStyles.underline}http://${Server.fixedIpAddress}:${this.port}${Server.logStyles.reset}`);
			});
			resolve(null);
		});
	}

	/**
	 * @param {string|"/"|"*"} path
	 * See [Uniform Resource Identifier (URI): Generic Syntax - Section 2.2](https://datatracker.ietf.org/doc/html/rfc3986#section-2.2) for all reserved characters
	 * 
	 * See [Uniform Resource Identifier (URI): Generic Syntax - Section 2.3](https://datatracker.ietf.org/doc/html/rfc3986#section-2.3) for all un-reserved characters
	 * @param {ServerCallbackFunction} callback
	 * 
	 * @param {HTTPMethod|HTTPMethod[]} methods
	 * See [HTTP Request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) for all methods
	 */
	endpoint(path, callback, methods) {
		if (!path) {
			console.error("⚠️  Cannot add an endpoint without a path.");
			return;
		}
		if (path in this.#endpoints) {
			console.error("⚠️  Cannot overwrite http://"+this.domain+":"+this.port+path);
			return;
		}
		if (typeof methods == "string") methods = [methods];
		if (Array.isArray(methods) == false) methods = null;
		else for (let i = 0; i < methods.length; i ++) {
			methods[i] = methods[i].toUpperCase();
		}

		this.#endpoints[path] = { callback, methods };
	}

	/**
	 * *Note*: All subdomains are only accessable when using loopback addresses (like "localhost")
	 * @param {string|{ domain:string, flags?:symbol[], customData?:ServerCustomData }} options
	 */
	subdomain(options) {
		if (typeof options == "string") {
			options = { domain: options };
		}

		if (!options.domain) {
			console.error("⚠️  Cannot add subdomain without a name.");
			return;
		}
		if (options.domain in this.#subdomains) {
			console.error(`⚠️  Cannot overwrite http://${options.domain}.${this.domain}:${this.port}`);
			return;
		}

		if (typeof options?.flags == "symbol") options.flags = [options.flags];

		options.customData = options?.customData ?? {};

		options.customData["subdomainServerReference"] = this;

		options.flags = options?.flags ?? [];
		options.flags.push(Server.flags._SUBDOMAIN);
		
		let subdomain = new Server(options);
		
		subdomain.info.whitelistEnabled = this.info.whitelistEnabled;
		subdomain.info.whitelistedIps = this.info.whitelistedIps;

		subdomain.info.blacklistEnabled = this.info.blacklistEnabled;
		subdomain.info.blacklistedIps = this.info.blacklistedIps;
		
		this.#subdomains[options.domain] = subdomain;
		return subdomain;
	}

	/**
	 * Similar to `Server.endpoint`, but run for status-codes like `404`.
	 * @param {number} statusCode
	 * @param {ServerCallbackFunction} callback
	 */
	status(statusCode, callback) {
		if (typeof statusCode != "number") {
			console.error("\nInvalid status code.");
			return;
		}
		if (path in this.#statusHandelers) {
			console.error(`\nCannot overwrite status code: ${statusCode}`);
			return;
		}
		this.#statusHandelers[statusCode] = callback;
	}

	/**
	 * Create a websocket endpoint on a given path.
	 * @param {string} path Endpoint path
	 * @returns {Websocket|undefined} Returns a Websocket endpoint (only if NPM "ws" package is installed)
	 */
	websocket(path) {
		return new Server.WebsocketConstructor(this, path);
	}

	/**
	 * @param {http.IncomingMessage} request 
	 * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }} result
	 * @param {?string} domain
	 */
	#processRequest(request, result, domain) {
		domain = domain ?? request.headers.host;
		domain = domain.replace(":"+this.port, "");

		let subdomain = domain.split(".").at(-2);

		let requestUrl = new URL("http://"+request.headers.host+request.url);
		let requestedPath = decodeURI(requestUrl.pathname ?? "/");

		if (domain == this.domain || domain.includes(".") == false) { // This is the requested (sub?) domain, serve endpoint/file

			if (requestedPath in this.#endpoints && (this.#endpoints[requestedPath].methods==null||this.#endpoints[requestedPath].methods.includes(request.method))) {
				let endpoint = this.#endpoints[requestedPath];
				endpoint.callback(request, result);

			} else if ("*" in this.#endpoints) {
				let endpoint = this.#endpoints["*"];
				endpoint.callback(request, result);

			} else if (this.flags[Server.flags.FILESYSTEM]) {
				if (this.customData["rootDirectory"]) {
					requestedPath = this.customData["rootDirectory"].replace(/\/$/, "") + requestedPath;
				}

				let statusPromise = Server.sendFile(requestedPath, result);

				statusPromise.then((status) => {
					if (status != 200) this.#throwHttpError(status, request, result);
				});

			} else {
				this.#throwHttpError(404, request, result);
			}

		} else if (subdomain in this.#subdomains) { // Pass along to a subdomain
			let newDomain = domain.replace("."+this.domain, "");
			this.#subdomains[subdomain].#processRequest(request, result, newDomain);

		} else { // Requested subdomain doesn't exist
			this.#throwHttpError(404, request, result);
		}

	}

	/**
	 * @param {number} statusCode
	 * @param {http.IncomingMessage} request 
	 * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }} result 
	 */
	async #throwHttpError(statusCode, request, result) {

		if (statusCode in this.#statusHandelers) {
			let callback = this.#statusHandelers[statusCode];
			
			if (callback.constructor.name == "AsyncFunction") {
				await callback(request, result);
			} else {
				callback(request, result);
			}

			if (result.writableEnded) return;
		}

		let message = Server.logMessageTemplates.http.default;

		let status = statusCode.toString();

		if (status in Server.logMessageTemplates.http) {
			message = Server.logMessageTemplates.http[status];
		}

		let formattedMessage = this.info.logMessage(message, { ip: Server.getIP(request), url: decodeURI(request.url), isError:true });

		result.writeHead(statusCode, { "Content-Type": "text/plain" });
		result.end(`Error ${statusCode}:\n\n${formattedMessage.client}`);


		if ( this.info.shouldLogFromRequest(request) == false ) return;

		console.log(formattedMessage.server);
	}

	info = {
		whitelistEnabled: false,
		blacklistEnabled: false,
		whitelistedIps: [],
		blacklistedIps: [],

		enableAll() {
			this.whitelistEnabled = false;
			this.blacklistEnabled = false;
		},
		disableAll() {
			this.whitelistEnabled = true;
			this.whitelistedIps = [];
			this.blacklistEnabled = true;
			this.blacklistedIps = [];
		},

		/**
		 * Returns a `boolean` for if a message should be logged baised on the request's IP address
		 * @param {http.IncomingMessage} request
		 * @returns {boolean}
		 */
		shouldLogFromRequest(request) {
			if (this.whitelistEnabled) {
				return this.whitelistedIps.includes(Server.getIP(request));

			} else if (this.blacklistEnabled) {
				return this.blacklistedIps.includes(Server.getIP(request)) == false;

			} else return true;
		},

		/**
		 * @param {string|{client:string,server:string}} reference
		 * @param {Object<string, any> & {ip:string, isError:boolean}} data
		 * @returns {string|{client:string,server:string}}
		 */
		logMessage(reference, data) {
			if (reference.client || reference.server) {
				return {
					client: reference?.client ? reference.client.replace(/\{\{(.*?)\}\}/g, (match, index) => eval(index) ) : "",
					server: reference?.server ? (
						(data?.isError ? "🔸 " : "🔹 ")+
						getTime()+
						" ["+Server.logStyles.blue + data.ip + Server.logStyles.reset+"] "+
						reference.server.replace(/\{\{(.*?)\}\}/g, (match, index) => eval(index) )+
						Server.logStyles.reset
					) : ""
				};
			}

			return (
				(data?.isError ? "🔸 " : "🔹 ")+
				getTime()+
				" ["+Server.logStyles.blue + data.ip + Server.logStyles.reset+"] "+
				reference.replace(/\{\{(.*?)\}\}/g, (match, index) => eval(index) )+
				Server.logStyles.reset
			);
		},

		/**
		 * Enables output logs for only the given `ipAdresses`
		 * 
		 * Disables all blacklisting
		 * @param {...string[]} ipAddresses
		 * ***Tip:*** If you want to whitelist this machine, you can use: It's IP address; `"127.0.0.1"`; Or `"local"`
		 */
		whitelist: (...ipAddresses) => {
			this.info.whitelistEnabled = true;
			this.info.blacklistEnabled = false;

			for (let i = 0; i < ipAddresses.length; i ++) {
				if (ipAddresses[i] == Server.fixedIpAddress || ipAddresses[i] == "local") ipAddresses[i] = "127.0.0.1";
				this.info.whitelistedIps.push( ipAddresses[i] );
			}
		},
		/**
		 * Disables output logs for only the given `ipAdresses`
		 * 
		 * Disables all whitelisting
		 * @param {...string[]} ipAddresses
		 * ***Tip:*** If you want to whitelist this machine, you can use: It's IP address; `"127.0.0.1"`; Or `"local"`
		 */
		blacklist: (...ipAddresses) => {
			this.info.blacklistEnabled = true;
			this.info.whitelistEnabled = false;

			for (let i = 0; i < ipAddresses.length; i ++) {
				if (ipAddresses[i] == Server.fixedIpAddress || ipAddresses[i] == "local") ipAddresses[i] = "127.0.0.1";
				this.info.blacklistedIps.push( ipAddresses[i] );
			}
		}

	}

	/**
	 * Get a client's IP address from a request
	 * @param {http.IncomingMessage} request
	 * @returns {?string}
	 */
	static getIP(request) {
		if (request instanceof http.IncomingMessage == false) return null;
		let ipAddress = request.socket.remoteAddress;

		if (ipAddress.startsWith("::ffff:")) ipAddress = ipAddress.replace("::ffff:", "");
		if (ipAddress == "::1") ipAddress = "127.0.0.1";

		return ipAddress;
	}

	/**
	 * Extract cookies from a client request
	 * @param {http.IncomingMessage} request 
	 * @returns {Promise<string|object>}
	 */
	static getBody(request) {
		return new Promise((resolve, reject) => {
			let body = "";

			let mime = (request.headers["content-type"]??"text/plain").split(";")[0].trim();
			
			request.on("data", (chunk) => {
				body += chunk;
			});
			
			request.on("end", () => {

				if (mime == Server.mimeTypes.json) {
					resolve(JSON.parse(body));
				} else resolve(body);
			});
		})
	}

	/**
	 * @param {string} path
	 * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }} result
	 * @returns {Promise<number>} Promise returning HTTP status code
	 */
	static sendFile(path, result) {

		return new Promise((resolve) => {

			if (result.writableEnded) {
				resolve(406); // Not Acceptable
				return;
			}

			if (path.startsWith("/")) path = path.replace("/", "");

			let pathname = "."+decodeURI( new URL("http://example.com/"+path).pathname );

			if ( (/\.([^/.]+)$/).test(pathname) == false ) { // Path has no file extension

				for (let indexFile of Server.defaultIndexes) {
					let extension = indexFile.match(/\.([^/.]+)$/)[0]; // EG: ".html", ".htm"

					if (fs.existsSync(pathname+extension) == false) continue;
					pathname += extension;

				}

			}

			let stats = fs.lstatSync(pathname, {throwIfNoEntry: false});

			if (stats?.isDirectory()) {

				for (let indexFile of Server.defaultIndexes) {

					if (fs.existsSync(pathname+"/"+indexFile) == false) continue;
					
					pathname += "/"+indexFile;
					break;

				}

			}

			if ( fs.existsSync(pathname) == false ) {
				resolve(404); // Not Found
				return;
			}

			fs.readFile(pathname, (err, data) => {
				if (err) {
					resolve(500); // Internal Server Error
					return;
				}

				let fileExtension = pathname.split(".").at(-1);
				let mimeType = Server.mimeTypes["txt"];

				if (fileExtension in Server.mimeTypes) {
					mimeType = Server.mimeTypes[fileExtension];
				}

				result.writeHead(200, { "Content-Type": mimeType });
				result.write(data);
				result.end();
				resolve(200); // OK
				return;
			});
		})
	}

	/**
	 * Extract cookies from a client request
	 * @param {http.IncomingMessage} request 
	 * @returns {Object<string, string>}
	 */
	static getCookies(request) {
		let list = {};
		if (!request.headers?.cookie) return list;

		let cookieParts = request.headers.cookie.split(";");

		for (let cookie of cookieParts) {
			let parts = cookie.split(/\s*?(\S+?)\s*=\s*(.*?)\s*$/);
			let name = parts[1];
			let value = parts[2];
			if (!value) continue;
			list[name] = decodeURIComponent(value);
		}

		return list;
	}

	/**
	 * Set a cookie on a client result
	 * @param {string} key
	 * @param {string} value
	 * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }} result
	 */
	static setCookie(key, value, result) {
		let existingCookies = result.getHeader("Set-Cookie") ?? [];

		existingCookies.push(key+"="+value);
		result.setHeader("Set-Cookie", existingCookies); 	
	}

	static flags = {
		/** Use if the server you are creating is a fileserver (no endpoints can be made) */
		FILESYSTEM: Symbol("flags:FILESYSTEM"),
		/** Hide all HTTP status logs from the console/terminal */
		HIDESTATUSLOGS: Symbol("flags:HIDESTATUSLOGS"),
		/** **⚠️ Internal use only ⚠️** */
		_SUBDOMAIN: Symbol("flags:_SUBDOMAIN")
	};

	static logMessageTemplates = require("./json/messages.json");

	static logStyles = require("./json/styles.json");

	static mimeTypes = require("./json/mime_types.json");

	static fixedIpAddress = ("Wi-Fi" in os.networkInterfaces()) ? os.networkInterfaces()["Wi-Fi"][0].address : "localhost";

	static defaultIndexes = ["index.html", "index.htm", "index.js", "index.json", "index.php"];

	/** @type {(server:Server, path:string) => Websocket} */
	static WebsocketConstructor(server, path) { throw new Error(`Failure to include "node-simple-server/lib/webocket.js"`) };
}

module.exports = Server;

Server.WebsocketConstructor = require("./lib/websocket.js");

/**
 * Formats the current time to be printed to the console/terminal
 * @returns {string}
 */
function getTime() {
	let date = new Date;

	let hours = date.getHours().toString().padStart(2, "0");
	let minutes = date.getMinutes().toString().padStart(2, "0");
	let seconds = date.getSeconds().toString().padStart(2, "0");
	let milliseconds = date.getMilliseconds().toString().padStart(3, "0");

	return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}