'use strict';

const { sendTextMessage, shutdownClient } = require('./whatsapp');

async function main() {
  const recipient = process.env.WHATSAPP_TO || process.argv[2];
  const message = process.env.WHATSAPP_MESSAGE || process.argv.slice(3).join(' ').trim();
  const apiUrl = process.env.WHATSAPP_API_URL;

  if (!recipient || !message) {
    console.error('Usage: npm run send -- <recipient> <message>');
    console.error('Or set WHATSAPP_TO and WHATSAPP_MESSAGE in the environment.');
    process.exit(1);
  }

  try {
    if (apiUrl) {
      const token = process.env.WHATSAPP_INTERNAL_TOKEN;
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Internal-Token': token } : {}),
        },
        body: JSON.stringify({
          to: recipient,
          message,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`);
      }

      console.log('Message sent.');
      return;
    }

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
