'use strict';

const { sendTextMessage, shutdownClient } = require('./whatsapp');

async function main() {
  const recipient = process.env.WHATSAPP_TO || process.argv[2];
  const message = process.env.WHATSAPP_MESSAGE || process.argv.slice(3).join(' ').trim();

  if (!recipient || !message) {
    console.error('Usage: npm run send -- <recipient> <message>');
    console.error('Or set WHATSAPP_TO and WHATSAPP_MESSAGE in the environment.');
    process.exit(1);
  }

  try {
    await sendTextMessage(recipient, message);
    console.log('Message sent.');
  } finally {
    await shutdownClient();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
