const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  try {
    const key = (event.queryStringParameters || {}).key;
    if (!key) {
      return { statusCode: 400, body: 'Missing key' };
    }

    const imageStore = getStore({
    name: 'images',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN,
  });
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
  } catch (err) {
    console.error('Image function error:', err);
    return { statusCode: 404, body: 'Not found' };
  }
};
