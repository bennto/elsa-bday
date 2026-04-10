const { getStore } = require('@netlify/blobs');
const busboy = require('busboy');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ---- Storage helpers ----
async function getMessages() {
  const store = getStore('birthday');
  const raw = await store.get('messages');
  return raw ? JSON.parse(raw) : [];
}

async function saveMessages(messages) {
  const store = getStore('birthday');
  await store.set('messages', JSON.stringify(messages));
}

// ---- Multipart parser ----
function parseMultipart(event) {
  const contentType =
    event.headers['content-type'] || event.headers['Content-Type'] || '';

  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: MAX_FILE_BYTES },
    });

    const fields = {};
    let fileData = null;
    let fileInfo = null;
    let fileTooLarge = false;

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (name, file, info) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('limit', () => { fileTooLarge = true; file.resume(); });
      file.on('end', () => {
        if (!fileTooLarge && chunks.length > 0) {
          fileData = Buffer.concat(chunks);
          fileInfo = info;
        }
      });
    });

    bb.on('finish', () => resolve({ fields, fileData, fileInfo, fileTooLarge }));
    bb.on('error', reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body || '');
    bb.write(body);
    bb.end();
  });
}

// ---- Handler ----
exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: JSON_HEADERS };
    }

    // GET — list all messages (newest first)
    if (event.httpMethod === 'GET') {
      const messages = await getMessages();
      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify(messages.slice().reverse()),
      };
    }

    // POST — create a new message
    if (event.httpMethod === 'POST') {
      const contentType =
        event.headers['content-type'] || event.headers['Content-Type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Expected multipart/form-data' }),
        };
      }

      let parsed;
      try {
        parsed = await parseMultipart(event);
      } catch (parseErr) {
        console.error('Multipart parse error:', parseErr);
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Failed to parse request' }),
        };
      }

      if (parsed.fileTooLarge) {
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Image must be under 5 MB' }),
        };
      }

      const name = (parsed.fields.name || '').trim().slice(0, 60);
      const text = (parsed.fields.text || '').trim().slice(0, 1000);

      if (!name) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Name is required' }) };
      }
      if (!text) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Message text is required' }) };
      }

      let imagePath = null;
      if (parsed.fileData && parsed.fileInfo) {
        const mimeType = parsed.fileInfo.mimeType;
        if (!ALLOWED_MIME.has(mimeType)) {
          return {
            statusCode: 400,
            headers: JSON_HEADERS,
            body: JSON.stringify({ error: 'Only image files are allowed' }),
          };
        }
        const ext = path.extname(parsed.fileInfo.filename || '').toLowerCase() || '.jpg';
        const key = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
        const imageStore = getStore('images');
        await imageStore.set(key, parsed.fileData, {
          metadata: { contentType: mimeType },
        });
        imagePath = `/uploads/${key}`;
      }

      const message = {
        id: Date.now().toString(),
        name,
        text,
        image: imagePath,
        createdAt: new Date().toISOString(),
      };

      const messages = await getMessages();
      messages.push(message);
      await saveMessages(messages);

      return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(message) };
    }

    // DELETE — remove a message by ?id=
    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'id required' }) };
      }

      const messages = await getMessages();
      const idx = messages.findIndex((m) => m.id === id);
      if (idx === -1) {
        return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Not found' }) };
      }

      const [removed] = messages.splice(idx, 1);
      await saveMessages(messages);

      if (removed.image) {
        const key = removed.image.replace('/uploads/', '');
        const imageStore = getStore('images');
        try { await imageStore.delete(key); } catch { /* best-effort */ }
      }

      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (err) {
    console.error('Unhandled function error:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
