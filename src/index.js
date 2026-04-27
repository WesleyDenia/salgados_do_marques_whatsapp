'use strict';

const { startClient } = require('./whatsapp');

async function main() {
  await startClient();
  console.log('Service started. Use "npm run send" to send a message.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = require('./whatsapp');
