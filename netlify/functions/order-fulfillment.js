const CLOVER_API_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://apisandbox.dev.clover.com'
    : 'https://api.clover.com';

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const accessToken = process.env.CLOVER_ACCESS_TOKEN;
    const orderId = event.queryStringParameters?.orderId;

    if (!merchantId || !accessToken) {
      return json(500, {
        error: 'Missing CLOVER_MERCHANT_ID or CLOVER_ACCESS_TOKEN'
      });
    }

    if (!orderId || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
      return json(400, { error: 'Missing or invalid orderId' });
    }

    const cloverOrder = await cloverFetch(
      `/v3/merchants/${merchantId}/orders/${encodeURIComponent(orderId)}?expand=orderFulfillmentEvent`,
      accessToken
    );

    const fulfillmentEvent = normalizeFulfillmentEvent(cloverOrder.orderFulfillmentEvent);

    return json(200, {
      success: true,
      orderId,
      source: fulfillmentEvent?.cloverFulfillmentTime ? 'clover' : 'none',
      orderFulfillmentEvent: fulfillmentEvent,
      pickupTime: fulfillmentEvent?.cloverFulfillmentTime || null,
      cloverFulfillmentTime: fulfillmentEvent?.cloverFulfillmentTime || null,
      clientCreatedTime: fulfillmentEvent?.clientCreatedTime || null,
      type: fulfillmentEvent?.type || ''
    });
  } catch (error) {
    return json(500, {
      error: 'Unable to load order fulfillment details',
      message: error.message
    });
  }
};

async function cloverFetch(path, accessToken) {
  const response = await fetch(`${CLOVER_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Clover API error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function normalizeFulfillmentEvent(value) {
  if (!value) return null;

  if (Array.isArray(value.elements)) {
    return value.elements[0] || null;
  }

  return value;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
