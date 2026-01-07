# http-simple-server

Creating a simple, self hosted, server.

## Features

- Endpoints
- Fileservers
  - To enable, initialize server with the `Server.flags.FILESYSTEM` flag.
- WebSockets
  - Will need to install "ws" package (`npm install ws`)
- Subdomains
  - Only available when accessing site through loopback addresses, like "localhost"

## Example

Below is an example server that has a single endpoint (located at `"/"`).

```js
const Server = require("http-simple-server");

const localhost = new Server(8080);

localhost.open(); // Begins to listen for connections

// Create an endpoint at "/"
localhost.endpoint("/", (request, result) => {

  // Write the HTTP headers (using status code 200)
  result.writeHead(200, {
    "Content-Type": Server.mimeTypes.txt // Content-Type: "text/plain"
  });
  result.write("Hello, World!"); // Write data
  result.end(); // Close the client-server connection
});
```

## `Server.flags`

### `Server.flags.FILESYSTEM`

Use if the server you are creating is a fileserver

Specify a starting directory using Server.

### `Server.flags.HIDESTATUSLOGS`

Hide all HTTP status logs from the console/terminal

### `Server.flags._SUBSERVER`

> **⚠️WARNING⚠️**: Internal use only

Used internally for creating subdomains.

When a subdomain is created, `ServerInitOptions.customData.subdomainServerReference` is set to the server the subdomain is created on
