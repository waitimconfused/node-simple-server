const Server = require("../index.js");
const WS_INSTALLED = checkRequire("ws");

const ws = WS_INSTALLED ? require("ws") : null;
const WebSocketServer = ws?.Server ?? class {};

/**
 * @typedef {object} WebsocketEventListener
 * @prop {"connection"|"error"|"message"|"close"} eventName
 * @prop {(socket, request)=>void} callback
 */

/** @type {Object<string, Websocket>} */
const WEBSOCKETS = {};

class Websocket {
	/** @type {symbol[]} See `Server.flags` */
	flags = [ Server.flags.ENDPOINT ];

	/** @type {Server} */
	#parentServer;
	endpoint = "/websocket";

	_websocketServer = new WebSocketServer({noServer: true});

	/** @type {WebsocketEventListener[]} */
	#eventListers = [];

	/**
	 * @param {Server} server
	 * @param {string} path
	*/
	constructor(server, path) {
		this.endpoint = path;
		this.#parentServer = server;
		
		if (path in WEBSOCKETS) return;

		WEBSOCKETS[path] = this;

		if (!WS_INSTALLED) {
			console.error(`🔌 You must install the "${Server.logStyles.underline}ws${Server.logStyles.reset}" package before using Websockets.\n\tPlease run ${Server.logStyles.yellow}npm install${Server.logStyles.reset} or ${Server.logStyles.yellow}npm install ws${Server.logStyles.reset}\n`);
			return;
		}

		console.log(`🔌 Websocket opened at ${Server.logStyles.underline}ws://${server.fullDomain}/${path}${Server.logStyles.reset}`);

		if (server._httpServer.listeners("upgrade").length == 0) { // If there is no "upgrade" listener to the server, add one
			server._httpServer.on("upgrade", (request, socket, head) => {
				
				let requestUrl = new URL(request.headers.origin+request.url);
				let requestedPath = requestUrl.pathname ?? "/";
				
				if (requestedPath in WEBSOCKETS == false) return;

				let websocket = WEBSOCKETS[requestedPath];
				
				websocket._websocketServer.handleUpgrade(request, socket, head, (ws) => {
					websocket._websocketServer.emit("connection", ws, request);
				});
				
			});
		}

		this._websocketServer.on("connection", (socket, request) => {
			
			this.#triggerEventListener("connection", request, socket, request);

			socket.on("error", (error) => {
				this.#triggerEventListener("error", request, socket, error);
			});

			socket.on("close", (code, reason) => {
				this.#triggerEventListener("close", request, socket, code, reason);
				socket.removeAllListeners();

				if (!socket.CLOSED) {
					socket.terminate();
					socket.close();
				}
			});


			socket.on("message", (data) => {
				this.#triggerEventListener("message", request, socket, data);
			});
		});

		this._websocketServer.on("error", (error) => {
			this.#triggerEventListener("close", null, null, error);
		});

	}

	static #callbackSymbol = Symbol("WEBSOCKET_LISTENER_CALLBACK")
	listen = {
		/**
		 * @param {(socket:ws, request:http.IncomingMessage, data)=>void} callback
		 */
		connection: (callback) => {
			callback[Websocket.#callbackSymbol] = { id: this.#eventListers.length };
			this.#eventListers.push({ eventName: "connection", callback });
		},

		/**
		 * @param {(socket:ws, error:Error)=>void} callback
		 */
		error: (callback) => {
			callback[Websocket.#callbackSymbol] = { id: this.#eventListers.length };
			this.#eventListers.push({ eventName: "error", callback });
		},

		/**
		 * @param {(socket:ws, data:ws.RawData)=>void} callback
		 */
		message: (callback) => {
			callback[Websocket.#callbackSymbol] = { id: this.#eventListers.length };
			this.#eventListers.push({ eventName: "message", callback });
		},

		/**
		 * @param {(socket:ws, code:number, reason:Buffer<ArrayBufferLike>)=>void} callback
		 */
		close: (callback) => {
			callback[Websocket.#callbackSymbol] = { id: this.#eventListers.length };
			this.#eventListers.push({ eventName: "close", callback });
		},

		/**
		 * @param {"connection"|"message"|"error"|"close"} eventType
		 * @param {(...data)=>void} callback
		 */
		removeListener:(eventType, callback) => {
			let targetId = callback[Websocket.#callbackSymbol].id;
			
			for (let i = 0; i < this.#eventListers.length; i ++) {
				if (this.#eventListers[i].eventName != eventType) continue;

				let eventId = this.#eventListers[i].callback[Websocket.#callbackSymbol].id;
				if (eventId != targetId) continue;

				this.#eventListers.splice(i, 1);
				break;
			}
		}
	}

	/**
	 * @param {"connection"|"error"|"message"|"close"} eventName 
	 * @param {http.IncomingMessage} request
	 * @param {...any} data 
	 */
	#triggerEventListener(eventName, request, ...data) {

		if (this.#parentServer.info.shouldLogFromRequest(request)){
			let message = this.#parentServer.info.logMessage(
				MESSAGES.websocket[eventName],
				{
					ip: Server.getIP(request),
					isError: false
				});
			console.log(message);
		}

		for (let i = 0; i < this.#eventListers.length; i ++) {
			if (this.#eventListers[i].eventName != eventName) continue;
			this.#eventListers[i].callback(...data);
		}
	}

}

/**
 * Check if an NPM module is installed
 * @param {string} id
 * @returns {boolean}
 */
function checkRequire(id) {
	try {
		require(id);
	} catch(e) {
		return false;
	}
	return true;
}

module.exports = Websocket;