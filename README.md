# http-simple-server

Creating a simple, self hosted, server.

## Features

- Endpoints
- fileservers
- WebSockets
  - Will need to install "ws" package (`npm install ws`)
- subdomains
  - Only available when accessing site through loopback addresses, like "localhost

## Example

```js
const Server = require("./index.js");

const localhost = new Server({
  port: 8080,
  flags: [Server.flags.FILESYSTEM],
  customData: {
    rootDirectory: "./examples/" // Optional
  }
});

localhost.open();

const websocketDomain = localhost.subdomain("ws");

// Create a websocket endpoint ("ws://ws.localhost:8080/example")
const websocket1 = websocketDomain.websocket("/example");

// Listen for message events, and return 
websocket1.listen.message((socket, data) => {
  socket.send("Reversed string:\n"+data.reverse());
});
```
