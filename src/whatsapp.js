'use strict';

require('dotenv').config();

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

let client;
let readyPromise;
let initialized = false;

function normalizeRecipient(recipient) {
  const value = String(recipient || '').trim();
  if (!value) {
    throw new Error('Recipient is required.');
  }

  if (value.includes('@c.us') || value.includes('@g.us')) {
    return value;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Recipient must contain at least one digit.');
  }

  return `${digits}@c.us`;
}

function createClient() {
  if (client) {
    return client;
  }

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'salgados-whatsapp',
    }),
    puppeteer: {
      headless: true,
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    },
  });

  client.on('qr', (qr) => {
    console.log('Scan this QR code to authenticate:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('WhatsApp client is ready.');
  });

  client.on('auth_failure', (message) => {
    console.error('WhatsApp authentication failed:', message);
  });

  client.on('disconnected', (reason) => {
    console.warn('WhatsApp client disconnected:', reason);
  });

  readyPromise = new Promise((resolve, reject) => {
    client.once('ready', () => resolve(client));
    client.once('auth_failure', (message) => {
      reject(new Error(`WhatsApp authentication failed: ${message}`));
    });
  });

  return client;
}

async function startClient() {
  const currentClient = createClient();

  if (!initialized) {
    initialized = true;
    currentClient.initialize();
  }

  return readyPromise;
}

async function sendTextMessage(recipient, message) {
  const currentClient = await startClient();
  const chatId = normalizeRecipient(recipient);
  return currentClient.sendMessage(chatId, String(message));
}

async function shutdownClient() {
  if (!client) {
    return;
  }

  try {
    await client.destroy();
  } finally {
    client = undefined;
    readyPromise = undefined;
    initialized = false;
  }
}

module.exports = {
  createClient,
  normalizeRecipient,
  sendTextMessage,
  shutdownClient,
  startClient,
};
