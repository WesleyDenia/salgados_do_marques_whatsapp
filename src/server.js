'use strict';

const http = require('http');

const { getSessionSnapshot, isClientReady, sendTextMessage } = require('./whatsapp');

function resolvePort(value, fallback = 3000) {
  const raw = String(value ?? '').trim();

  if (raw === '') {
    return fallback;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.warn(`[server] Invalid PORT value "${raw}", falling back to ${fallback}.`);
    return fallback;
  }

  return port;
}

const PORT = resolvePort(process.env.PORT, 3000);
const INTERNAL_TOKEN = process.env.WHATSAPP_INTERNAL_TOKEN || '';

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req, limitBytes = 1_048_576) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function isAuthorized(req) {
  if (!INTERNAL_TOKEN) {
    return true;
  }

  const headerToken = req.headers['x-internal-token'];
  if (typeof headerToken === 'string' && headerToken === INTERNAL_TOKEN) {
    return true;
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7) === INTERNAL_TOKEN;
  }

  return false;
}

async function handleSend(req, res) {
  if (!isAuthorized(req)) {
    jsonResponse(res, 401, {
      ok: false,
      error: 'Unauthorized',
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    jsonResponse(res, 400, {
      ok: false,
      error: error.message,
    });
    return;
  }

  const recipient = body.to || body.recipient || body.phone;
  const message = body.message || body.text;

  if (!recipient || !message) {
    jsonResponse(res, 422, {
      ok: false,
      error: 'Fields "to" and "message" are required.',
    });
    return;
  }

  try {
    const result = await sendTextMessage(recipient, message);
    jsonResponse(res, 200, {
      ok: true,
      sent: true,
      chatId: result?.id?._serialized || null,
      messageId: result?.id?.id || null,
      whatsappReady: isClientReady(),
    });
  } catch (error) {
    jsonResponse(res, 500, {
      ok: false,
      error: error.message,
    });
  }
}

function startServer(port = PORT) {
  const resolvedPort = resolvePort(port, PORT);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    jsonResponse(res, 200, {
      ok: true,
      whatsappReady: isClientReady(),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/session') {
    if (!isAuthorized(req)) {
      jsonResponse(res, 401, {
        ok: false,
        error: 'Unauthorized',
      });
      return;
    }

    jsonResponse(res, 200, {
      ok: true,
      whatsappReady: isClientReady(),
      session: getSessionSnapshot(),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/send') {
    handleSend(req, res);
    return;
  }

    jsonResponse(res, 404, {
      ok: false,
      error: 'Not found',
    });
  });

  server.listen(resolvedPort, () => {
    console.log(`HTTP server listening on port ${resolvedPort}`);
    if (!INTERNAL_TOKEN) {
      console.warn('WHATSAPP_INTERNAL_TOKEN is not set. /send is currently unprotected.');
    }
  });

  return server;
}

module.exports = {
  startServer,
};
