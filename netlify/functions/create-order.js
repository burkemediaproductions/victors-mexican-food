const CLOVER_API_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://apisandbox.dev.clover.com'
    : 'https://api.clover.com';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const accessToken = process.env.CLOVER_ACCESS_TOKEN;

    if (!merchantId || !accessToken) {
      return json(500, {
        error: 'Missing CLOVER_MERCHANT_ID or CLOVER_ACCESS_TOKEN'
      });
    }

    const body = JSON.parse(event.body || '{}');
    const { customerName, phone, email, orderNotes, cart } = body;

    if (!Array.isArray(cart) || !cart.length) {
      return json(400, { error: 'Cart is empty' });
    }

    const orderCart = {
      title: `Website Order - ${customerName || 'Guest'}`,
      note: buildOrderNote({ customerName, phone, email, orderNotes }),
      lineItems: cart.flatMap((cartItem) => {
        return Array.from({ length: cartItem.quantity || 1 }).map(() => ({
          item: { id: cartItem.id },
          name: cartItem.name,
          price: cartItem.price || 0,
          note: cartItem.note || ''
        }));
      })
    };

    const cloverResponse = await cloverFetch(
      `/v3/merchants/${merchantId}/atomic_order/orders`,
      {
        method: 'POST',
        body: JSON.stringify({ orderCart })
      },
      accessToken
    );

    return json(200, {
      success: true,
      orderId: cloverResponse.id,
      cloverOrder: cloverResponse
    });
  } catch (error) {
    return json(500, {
      error: 'Unable to create Clover order',
      message: error.message
    });
  }
};

async function cloverFetch(path, options, accessToken) {
  const response = await fetch(`${CLOVER_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Clover API error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function buildOrderNote({ customerName, phone, email, orderNotes }) {
  return [
    'Website order',
    customerName ? `Name: ${customerName}` : '',
    phone ? `Phone: ${phone}` : '',
    email ? `Email: ${email}` : '',
    orderNotes ? `Notes: ${orderNotes}` : ''
  ]
    .filter(Boolean)
    .join('\n');
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