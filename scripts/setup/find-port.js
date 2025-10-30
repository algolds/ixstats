#!/usr/bin/env node

import net from "net";

function findAvailablePort(startPort = 3000, maxPort = 9999) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(startPort, () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : startPort;
      server.close(() => {
        resolve(port);
      });
    });

    server.on("error", (err) => {
      if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
        if (startPort < maxPort) {
          findAvailablePort(startPort + 1, maxPort)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`No available ports found between ${startPort} and ${maxPort}`));
        }
      } else {
        reject(err);
      }
    });
  });
}

// If run directly, find and output an available port
if (import.meta.url === `file://${process.argv[1]}`) {
  findAvailablePort()
    .then((port) => {
      console.log(port);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error finding available port:", err.message);
      process.exit(1);
    });
}

export { findAvailablePort };
