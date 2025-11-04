const Server = require("./index.js");

const localhost = new Server({
	port: 8080,
	flags: Server.flags.FILESYSTEM,
	customData: {
		rootDirectory: "./examples/"
	}
});

localhost.open();
localhost.info.disableAll();

const websocketDomain = localhost.subdomain("ws");

const websocket1 = websocketDomain.websocket("/example");

websocket1.listen.message((socket, data) => {
	socket.send("Reversed string:\n"+data.reverse());
});