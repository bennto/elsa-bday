const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const key = (event.queryStringParameters || {}).key;
  if (!key) {
    return { statusCode: 400, body: 'Missing key' };
  }

  const imageStore = getStore('images');

  try {
    const result = await imageStore.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!result || result.data === null) {
      return { statusCode: 404, body: 'Not found' };
    }

    const contentType = result.metadata?.contentType || 'image/jpeg';
    const buffer = Buffer.from(result.data);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch {
    return { statusCode: 404, body: 'Not found' };
  }
};
