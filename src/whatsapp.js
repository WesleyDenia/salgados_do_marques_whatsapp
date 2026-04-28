'use strict';

require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

let client;
let readyPromise;
let initialized = false;
let ready = false;
let sessionStatus = 'idle';
let lastError = null;
let currentQr = null;
let currentQrDataUrl = null;
let currentQrGeneratedAt = null;
const AUTH_DATA_PATH = path.resolve(process.env.WHATSAPP_AUTH_PATH || './.wwebjs_auth/');
const AUTH_SESSION_DIR = path.join(AUTH_DATA_PATH, 'session-salgados-whatsapp');
const CHROMIUM_LOCK_FILES = [
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
  'DevToolsActivePort',
];

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
      dataPath: AUTH_DATA_PATH,
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
    sessionStatus = 'qr';
    currentQr = qr;
    currentQrGeneratedAt = new Date().toISOString();
    currentQrDataUrl = null;
    console.log('Scan this QR code to authenticate:');
    qrcode.generate(qr, { small: true });

    QRCode.toDataURL(qr, {
      margin: 1,
      scale: 8,
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        currentQrDataUrl = dataUrl;
      })
      .catch((error) => {
        console.warn('Failed to generate QR code data URL:', error.message);
      });
  });

  client.on('ready', () => {
    ready = true;
    sessionStatus = 'ready';
    currentQr = null;
    currentQrDataUrl = null;
    currentQrGeneratedAt = null;
    lastError = null;
    console.log('WhatsApp client is ready.');
  });

  client.on('auth_failure', (message) => {
    ready = false;
    sessionStatus = 'auth_failure';
    currentQr = null;
    currentQrDataUrl = null;
    currentQrGeneratedAt = null;
    lastError = message;
    console.error('WhatsApp authentication failed:', message);
  });

  client.on('disconnected', (reason) => {
    ready = false;
    sessionStatus = 'disconnected';
    currentQr = null;
    currentQrDataUrl = null;
    currentQrGeneratedAt = null;
    lastError = reason;
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

async function clearStaleChromiumLocks() {
  const results = await Promise.allSettled(
    CHROMIUM_LOCK_FILES.map((filename) =>
      fs.unlink(path.join(AUTH_SESSION_DIR, filename)),
    ),
  );

  return results.some((result) => result.status === 'fulfilled');
}

function isChromiumProfileLockError(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('The profile appears to be in use by another Chromium process') ||
    message.includes('Failed to launch the browser process') ||
    message.includes('Code: 21')
  );
}

function resetClientState() {
  client = undefined;
  readyPromise = undefined;
  initialized = false;
  ready = false;
}

async function startClient() {
  const currentClient = createClient();

  if (!initialized) {
    initialized = true;
    sessionStatus = 'initializing';
    try {
      await currentClient.initialize();
    } catch (error) {
      if (isChromiumProfileLockError(error)) {
        console.warn('Detected a stale Chromium profile lock. Cleaning session locks and retrying once.');
        try {
          await clearStaleChromiumLocks();
        } catch (cleanupError) {
          console.warn('Failed to clean Chromium lock files:', cleanupError.message);
        }

        resetClientState();
        const retryClient = createClient();
        initialized = true;
        sessionStatus = 'initializing';
        await retryClient.initialize();
      } else {
        lastError = error.message;
        resetClientState();
        throw error;
      }
    }
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
    resetClientState();
  }
}

function isClientReady() {
  return ready;
}

function getSessionSnapshot() {
  return {
    status: sessionStatus,
    ready,
    initialized,
    hasQr: Boolean(currentQrDataUrl),
    qr: currentQr,
    qrDataUrl: currentQrDataUrl,
    qrGeneratedAt: currentQrGeneratedAt,
    lastError,
  };
}

module.exports = {
  createClient,
  getSessionSnapshot,
  isClientReady,
  normalizeRecipient,
  sendTextMessage,
  shutdownClient,
  startClient,
};
