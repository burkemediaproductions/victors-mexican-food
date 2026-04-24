const crypto = require('crypto');

const CLOVER_ECOMM_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://scl-sandbox.dev.clover.com'
    : 'https://scl.clover.com';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const privateKey = process.env.CLOVER_PRIVATE_KEY;

    if (!privateKey) {
      return json(500, { error: 'Missing CLOVER_PRIVATE_KEY' });
    }

    const { source, amount, orderId } = JSON.parse(event.body || '{}');

    if (!source || !amount || !orderId) {
      return json(400, {
        error: 'Missing source, amount, or orderId'
      });
    }

    const response = await fetch(`${CLOVER_ECOMM_BASE}/v1/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        amount,
        currency: 'usd',
        source,
        description: `Victor's Mexican Food website order ${orderId}`,
        metadata: {
          orderId
        }
      })
    });

    const text = await response.text();

    if (!response.ok) {
      return json(response.status, {
        error: 'Clover payment failed',
        message: text
      });
    }

    return json(200, {
      success: true,
      charge: text ? JSON.parse(text) : {}
    });
  } catch (error) {
    return json(500, {
      error: 'Unable to process payment',
      message: error.message
    });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}