const crypto = require('crypto');

const CLOVER_ECOMM_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://scl-sandbox.dev.clover.com'
    : 'https://scl.clover.com';

const CLOVER_API_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://apisandbox.dev.clover.com'
    : 'https://api.clover.com';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const privateKey = process.env.CLOVER_PRIVATE_KEY;
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const accessToken = process.env.CLOVER_ACCESS_TOKEN;

    if (!privateKey) {
      return json(500, { error: 'Missing CLOVER_PRIVATE_KEY' });
    }

    const { source, amount, orderId } = JSON.parse(event.body || '{}');

    if (!source || !amount || !orderId) {
      return json(400, {
        error: 'Missing source, amount, or orderId'
      });
    }

    const chargeResponse = await fetch(`${CLOVER_ECOMM_BASE}/v1/charges`, {
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

    const chargeText = await chargeResponse.text();

    if (!chargeResponse.ok) {
      return json(chargeResponse.status, {
        error: 'Clover payment failed',
        message: chargeText
      });
    }

    const charge = chargeText ? JSON.parse(chargeText) : {};

    const printResult = await printOrder({
      merchantId,
      accessToken,
      orderId
    });

    return json(200, {
      success: true,
      charge,
      print: printResult
    });
  } catch (error) {
    return json(500, {
      error: 'Unable to process payment',
      message: error.message
    });
  }
};

async function printOrder({ merchantId, accessToken, orderId }) {
  if (!merchantId || !accessToken || !orderId) {
    return {
      success: false,
      skipped: true,
      message: 'Missing CLOVER_MERCHANT_ID, CLOVER_ACCESS_TOKEN, or orderId'
    };
  }

  try {
    const response = await fetch(
      `${CLOVER_API_BASE}/v3/merchants/${merchantId}/print_event`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderRef: {
            id: orderId
          }
        })
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: text
      };
    }

    return {
      success: true,
      printEvent: text ? JSON.parse(text) : {}
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

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