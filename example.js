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

localhost.endpoint("/", (request, result) => {
	result.writeHead("Content-Type", Server.mimeTypes.txt);
	result.write("Hello, World!");
	result.end();
});

const websocket = localhost.websocket("/ws");

websocket.listen("message", (socket, request, data) => {
	socket.send("Reversed string:\n"+data.reverse());
});