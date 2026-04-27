'use strict';

const { startClient } = require('./whatsapp');
const { startServer } = require('./server');

async function main() {
  startClient().catch((error) => {
    console.error(error);
    process.exit(1);
  });

  startServer();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = require('./whatsapp');
