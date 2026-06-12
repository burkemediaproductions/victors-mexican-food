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

    const {
      source,
      amount,
      orderId,
      customerEmail,
      customerName,
      pickupEstimate,
      tipAmount = 0
    } = JSON.parse(event.body || '{}');

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
          orderId,
          tipAmount: String(Math.max(0, Number(tipAmount || 0) || 0))
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

    const orderDetails = await getOrderDetails({
      merchantId,
      accessToken,
      orderId
    });

    const confirmation = await sendConfirmationEmail({
      orderId,
      amount,
      charge,
      orderDetails,
      customerEmail,
      customerName,
      pickupEstimate,
      tipAmount
    });

    return json(200, {
      success: true,
      charge,
      print: printResult,
      confirmation
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

async function getOrderDetails({ merchantId, accessToken, orderId }) {
  if (!merchantId || !accessToken || !orderId) {
    return {
      success: false,
      skipped: true,
      message: 'Missing Clover order details credentials'
    };
  }

  try {
    const response = await fetch(
      `${CLOVER_API_BASE}/v3/merchants/${merchantId}/orders/${encodeURIComponent(orderId)}?expand=lineItems,customers,orderFulfillmentEvent`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
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
      order: text ? JSON.parse(text) : {}
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

async function sendConfirmationEmail({
  orderId,
  amount,
  charge,
  orderDetails,
  customerEmail,
  customerName,
  pickupEstimate,
  tipAmount = 0
}) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM || process.env.MAILGUN_FROM_EMAIL;

  if (!apiKey || !domain || !from) {
    return {
      success: false,
      skipped: true,
      message: 'Missing MAILGUN_API_KEY, MAILGUN_DOMAIN, or MAILGUN_FROM'
    };
  }

  const order = orderDetails?.order || {};
  const noteFields = parseOrderNote(order.note || '');
  const to = sanitizeEmail(customerEmail || noteFields.email || getCustomerEmail(order));

  if (!to) {
    return {
      success: false,
      skipped: true,
      message: 'No customer email found for confirmation'
    };
  }

  const name = customerName || noteFields.name || getCustomerName(order) || 'there';
  const total = formatMoney(amount || order.total || charge?.amount || 0);
  const estimatedPickup = pickupEstimate || getPickupEstimate(order) || '';
  const orderItems = getOrderItems(order);
  const subject = `Your Victor's Mexican Food order is confirmed`;

  const text = buildConfirmationText({
    name,
    orderId,
    total,
    estimatedPickup,
    orderItems,
    tipAmount
  });

  const html = buildConfirmationHtml({
    name,
    orderId,
    total,
    estimatedPickup,
    orderItems,
    tipAmount
  });

  try {
    const form = new URLSearchParams();
    form.append('from', from);
    form.append('to', to);
    form.append('subject', subject);
    form.append('text', text);
    form.append('html', html);

    const response = await fetch(
      `https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: responseText
      };
    }

    return {
      success: true,
      to,
      message: responseText ? safeJsonParse(responseText) || responseText : ''
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

function parseOrderNote(note) {
  const fields = {};

  String(note || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) return;

      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();

      if (key === 'name') fields.name = value;
      if (key === 'email') fields.email = value;
      if (key === 'phone') fields.phone = value;
    });

  return fields;
}

function getCustomerEmail(order) {
  const customers = order?.customers?.elements || [];
  const emails = customers.flatMap(customer => customer.emailAddresses?.elements || customer.emailAddresses || []);
  return emails.find(email => email?.emailAddress)?.emailAddress || '';
}

function getCustomerName(order) {
  const customer = (order?.customers?.elements || [])[0];

  if (!customer) return '';

  return [customer.firstName, customer.lastName]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
}

function getOrderItems(order) {
  const lineItems = order?.lineItems?.elements || [];

  return lineItems
    .map((item) => {
      const name = String(item.name || item.item?.name || 'Menu item').trim();
      const note = String(item.note || '').trim();
      const price = Number(item.price || 0);

      return {
        name,
        note,
        price
      };
    })
    .filter(item => item.name);
}

function getPickupEstimate(order) {
  const fulfillment = normalizeFulfillmentEvent(order?.orderFulfillmentEvent);
  const timestamp =
    fulfillment?.cloverFulfillmentTime ||
    fulfillment?.clientCreatedTime ||
    null;

  if (!timestamp) return '';

  const date = new Date(Number(timestamp));

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles'
  });
}

function normalizeFulfillmentEvent(value) {
  if (!value) return null;
  if (Array.isArray(value.elements)) return value.elements[0] || null;
  return value;
}

function buildConfirmationText({ name, orderId, total, estimatedPickup, orderItems, tipAmount = 0 }) {
  const itemLines = orderItems.length
    ? orderItems.flatMap((item) => {
        const lines = [`- ${item.name}${item.price ? ` (${formatMoney(item.price)})` : ''}`];
        if (item.note) lines.push(`  ${item.note.replace(/\n/g, '\n  ')}`);
        return lines;
      })
    : ['Your order has been received.'];

  return [
    `Hi ${name},`,
    '',
    `Thank you for your order from Victor's Mexican Food!`,
    '',
    `Order ID: ${orderId}`,
    Number(tipAmount || 0) > 0 ? `Tip: ${formatMoney(tipAmount)}` : '',
    `Total paid: ${total}`,
    estimatedPickup ? `Estimated pickup around ${estimatedPickup}` : '',
    '',
    `Your order:`,
    ...itemLines,
    '',
    `We'll have your order ready as soon as possible.`,
    '',
    `Victor's Mexican Food`,
    `74600 CA-111, Palm Desert, CA 92260`,
    `(760) 340-5959`
  ].filter(line => line !== '').join('\n');
}

function buildConfirmationHtml({ name, orderId, total, estimatedPickup, orderItems, tipAmount = 0 }) {
  const safeName = escapeHtml(firstNameOnly(name));
  const safeOrderId = escapeHtml(orderId);
  const safeTotal = escapeHtml(total);
  const safePickup = escapeHtml(estimatedPickup);

  const logoUrl = 'https://victorsmexicanfood.com/assets/img/logo-white.png';
  const orderAgainUrl = 'https://victorsmexicanfood.com/menu/';
  const directionsUrl = 'https://www.google.com/maps/search/?api=1&query=Victor%27s%20Mexican%20Food%2074600%20CA-111%20Palm%20Desert%20CA%2092260';
  const facebookUrl = 'https://www.facebook.com/victorsmexicanfood/';
  const instagramUrl = 'https://www.instagram.com/victorsmexicanfood';
  const youtubeUrl = 'https://www.youtube.com/@VictorsMexicanFood';
  const googleReviewUrl = 'https://g.page/r/CUgmzmROtFRnEAE/review';
  const yelpUrl = 'https://www.yelp.com/biz/victor-s-mexican-food-palm-desert-3';

  const itemsHtml = orderItems.length
    ? orderItems.map((item) => {
        const itemNote = String(item.note || '').trim();
        return `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #f1e2d4;">
              <div style="font-size:16px;font-weight:700;color:#21130c;">${escapeHtml(item.name)}</div>
              ${itemNote ? `<div style="font-size:13px;line-height:1.5;color:#7b604e;margin-top:4px;white-space:pre-line;">${escapeHtml(itemNote)}</div>` : ''}
            </td>
            <td align="right" style="padding:14px 0;border-bottom:1px solid #f1e2d4;font-size:15px;font-weight:700;color:#21130c;white-space:nowrap;">
              ${item.price ? escapeHtml(formatMoney(item.price)) : ''}
            </td>
          </tr>`;
      }).join('')
    : `
          <tr>
            <td style="padding:14px 0;color:#7b604e;">Your order has been received.</td>
          </tr>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>Your Victor's Mexican Food order is confirmed</title>
  </head>
  <body style="margin:0;background:#fff7ed;font-family:Arial,Helvetica,sans-serif;color:#21130c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #f0ddca;box-shadow:0 16px 40px rgba(49,31,19,.10);">
            <tr>
              <td style="background:#0b6b42;padding:30px 24px;text-align:center;color:#ffffff;">
                <img src="${logoUrl}" alt="Victor's Mexican Food" width="210" style="display:block;margin:0 auto 18px;max-width:210px;height:auto;">
                <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:#ffd166;">Order confirmed</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.05;letter-spacing:.02em;text-transform:uppercase;">Thank you, ${safeName}!</h1>
                <p style="margin:10px 0 0;font-size:16px;line-height:1.5;color:#fff6e8;">We received your order and sent it to the kitchen.</p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 24px 10px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:18px;border:1px solid #f1e2d4;">
                  <tr>
                    <td style="padding:18px 18px 8px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#8a3c22;">Order ID</td>
                    <td align="right" style="padding:18px 18px 8px;font-size:16px;font-weight:800;color:#21130c;">${safeOrderId}</td>
                  </tr>
                  ${Number(tipAmount || 0) > 0 ? `
                  <tr>
                    <td style="padding:8px 18px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#8a3c22;">Tip</td>
                    <td align="right" style="padding:8px 18px;font-size:16px;font-weight:800;color:#21130c;">${escapeHtml(formatMoney(tipAmount))}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:8px 18px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#8a3c22;">Total paid</td>
                    <td align="right" style="padding:8px 18px;font-size:16px;font-weight:800;color:#21130c;">${safeTotal}</td>
                  </tr>
                  ${safePickup ? `
                  <tr>
                    <td style="padding:8px 18px 18px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#8a3c22;">Pickup</td>
                    <td align="right" style="padding:8px 18px 18px;font-size:16px;font-weight:800;color:#21130c;">Estimated around ${safePickup}</td>
                  </tr>` : ''}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 24px 4px;">
                <h2 style="margin:0 0 6px;font-size:22px;line-height:1.2;color:#21130c;">Your order</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${itemsHtml}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 24px 8px;">
                <div style="background:#fdf0d5;border-left:5px solid #d62828;border-radius:14px;padding:16px 18px;color:#5e4637;font-size:15px;line-height:1.6;">
                  We'll have your order ready as soon as possible. Please check in at the counter when you arrive.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 24px 10px;text-align:center;">
                <a href="${directionsUrl}" style="display:inline-block;background:#0b6b42;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 22px;margin:4px;font-size:14px;">Get directions</a>
                <a href="${orderAgainUrl}" style="display:inline-block;background:#d62828;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 22px;margin:4px;font-size:14px;">Order again</a>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 24px 24px;text-align:center;">
                <p style="font-size:15px;line-height:1.7;margin:0;color:#5e4637;">
                  <strong style="color:#21130c;">Victor's Mexican Food</strong><br>
                  74600 CA-111, Palm Desert, CA 92260<br>
                  <a href="tel:+17603405959" style="color:#0b6b42;font-weight:700;text-decoration:none;">(760) 340-5959</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="background:#fff1dc;padding:24px;text-align:center;border-top:1px solid #f1e2d4;">
                <h3 style="margin:0 0 8px;font-size:20px;color:#21130c;">Enjoy your food?</h3>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#5e4637;">Reviews help local customers find Victor's. We'd be grateful if you shared your experience.</p>
                <a href="${googleReviewUrl}" style="display:inline-block;background:#21130c;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:12px 18px;margin:4px;font-size:14px;">Review on Google</a>
                <a href="${yelpUrl}" style="display:inline-block;background:#af0606;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:12px 18px;margin:4px;font-size:14px;">Review on Yelp</a>
              </td>
            </tr>

            <tr>
              <td style="background:#21130c;padding:18px 24px;text-align:center;color:#fff7ed;font-size:13px;line-height:1.8;">
                <div style="margin-bottom:8px;">Follow Victor's Mexican Food</div>
                <a href="${facebookUrl}" style="color:#ffd166;text-decoration:none;font-weight:700;margin:0 8px;">Facebook</a>
                <a href="${instagramUrl}" style="color:#ffd166;text-decoration:none;font-weight:700;margin:0 8px;">Instagram</a>
                <a href="${youtubeUrl}" style="color:#ffd166;text-decoration:none;font-weight:700;margin:0 8px;">YouTube</a>
              </td>
            </tr>
          </table>

          <p style="max-width:640px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8a7669;text-align:center;">
            This confirmation was sent for an online order placed through Victor's Mexican Food.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
function firstNameOnly(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'there';
}

function sanitizeEmail(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
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
