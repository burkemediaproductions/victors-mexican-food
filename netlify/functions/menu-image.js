const CLOVER_API_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://sandbox.dev.clover.com'
    : 'https://api.clover.com';

exports.handler = async function (event) {
  try {
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const accessToken = process.env.CLOVER_ACCESS_TOKEN;
    const itemId = event.queryStringParameters?.itemId;

    if (!merchantId || !accessToken) {
      return text(500, 'Missing CLOVER_MERCHANT_ID or CLOVER_ACCESS_TOKEN');
    }

    if (!itemId || !/^[A-Za-z0-9_-]+$/.test(itemId)) {
      return text(400, 'Missing or invalid itemId');
    }

    const response = await fetch(
      `${CLOVER_API_BASE}/v3/merchants/${merchantId}/items/${itemId}/image`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      }
    );

    if (!response.ok) {
      return text(response.status, 'Image unavailable');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*'
      },
      body: buffer.toString('base64')
    };
  } catch (error) {
    return text(500, error.message || 'Image unavailable');
  }
};

function text(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*'
    },
    body
  };
}
