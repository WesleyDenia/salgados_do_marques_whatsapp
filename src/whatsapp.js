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
const BACKEND_WEBHOOK_URL = process.env.WHATSAPP_BACKEND_URL || '';
const BACKEND_INTERNAL_TOKEN = process.env.WHATSAPP_INTERNAL_TOKEN || '';
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

async function getContactName(message) {
  try {
    const contact = await message.getContact();

    return contact?.pushname || contact?.name || contact?.shortName || null;
  } catch (error) {
    return null;
  }
}

function buildInboundPayload(message, contactName) {
  const body = typeof message.body === 'string' ? message.body : '';

  return {
    message_id: message.id?._serialized || null,
    chat_id: message.from || null,
    from: message.from || null,
    to: message.to || null,
    author: message.author || null,
    body,
    type: message.type || null,
    timestamp: typeof message.timestamp === 'number' ? message.timestamp : null,
    is_group: Boolean(message.isGroupMsg),
    has_media: Boolean(message.hasMedia),
    media_mime_type: message.mimeType || null,
    contact_name: contactName || null,
    source: 'salgados-whatsapp',
  };
}

async function forwardIncomingMessage(message) {
  if (!BACKEND_WEBHOOK_URL) {
    return;
  }

  if (!message || message.fromMe) {
    return;
  }

  const contactName = await getContactName(message);
  const payload = buildInboundPayload(message, contactName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (BACKEND_INTERNAL_TOKEN) {
      headers['X-Internal-Token'] = BACKEND_INTERNAL_TOKEN;
    }

    const response = await fetch(BACKEND_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      console.warn('Failed to forward inbound WhatsApp message:', {
        status: response.status,
        body: responseBody,
      });
      return;
    }

    const result = await response.json().catch(() => null);
    console.log('Inbound WhatsApp message queued in backend.', {
      messageId: payload.message_id,
      chatId: payload.chat_id,
      backendItemId: result?.item_id || null,
    });
  } catch (error) {
    console.warn('Error while forwarding inbound WhatsApp message:', {
      messageId: message?.id?._serialized || null,
      error: error.message,
    });
  } finally {
    clearTimeout(timeout);
  }
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

  client.on('message_create', (message) => {
    void forwardIncomingMessage(message);
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
