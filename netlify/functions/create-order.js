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

    // Customer lookup/create is intentionally non-blocking.
    // If this Clover token does not have customer permissions yet, the order still works.
    const customerSync = await syncCloverCustomer({
      merchantId,
      accessToken,
      customerName,
      phone,
      email
    });

    const orderCart = {
      title: `Website Order - ${customerName || 'Guest'}`,
      note: buildOrderNote({
        customerName,
        phone,
        email,
        orderNotes,
        customerSync
      }),
      lineItems: cart.flatMap((cartItem) => {
        return Array.from({ length: cartItem.quantity || 1 }).map(() => buildLineItem(cartItem));
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

    const customerAttach = await attachCustomerToOrder({
      merchantId,
      accessToken,
      orderId: cloverResponse.id,
      customerId: customerSync?.customer?.id
    });

    const refreshedOrder = await getCloverOrder({
      merchantId,
      accessToken,
      orderId: cloverResponse.id
    });

    const checkoutTotals = buildCheckoutTotals({
      cart,
      cloverOrder: refreshedOrder || cloverResponse
    });

    return json(200, {
      success: true,
      orderId: cloverResponse.id,
      cloverOrder: refreshedOrder || cloverResponse,
      checkoutTotals,
      customerSync,
      customerAttach
    });
  } catch (error) {
    return json(500, {
      error: 'Unable to create Clover order',
      message: error.message
    });
  }
};

async function cloverFetch(path, options = {}, accessToken) {
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
    const error = new Error(`Clover API error ${response.status}: ${text}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }

  return text ? JSON.parse(text) : {};
}

async function syncCloverCustomer({ merchantId, accessToken, customerName, phone, email }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    return {
      success: false,
      skipped: true,
      reason: 'No email or phone provided'
    };
  }

  try {
    const existingCustomer = await findCloverCustomer({
      merchantId,
      accessToken,
      email: normalizedEmail,
      phone: normalizedPhone
    });

    if (existingCustomer) {
      await ensureCustomerContactDetails({
        merchantId,
        accessToken,
        customer: existingCustomer,
        email: normalizedEmail,
        phone: normalizedPhone
      });

      return {
        success: true,
        action: 'matched',
        customer: sanitizeCustomer(existingCustomer)
      };
    }

    const createdCustomer = await createCloverCustomer({
      merchantId,
      accessToken,
      customerName,
      email: normalizedEmail,
      phone: normalizedPhone
    });

    return {
      success: true,
      action: 'created',
      customer: sanitizeCustomer(createdCustomer)
    };
  } catch (error) {
    return {
      success: false,
      skipped: true,
      reason: 'Customer lookup/create failed',
      status: error.status || null,
      message: error.message
    };
  }
}

async function findCloverCustomer({ merchantId, accessToken, email, phone }) {
  const candidates = [];

  if (email) {
    candidates.push(
      `emailAddresses.emailAddress=${email}`,
      `emailAddresses.emailAddress==${email}`
    );
  }

  if (phone) {
    candidates.push(
      `phoneNumbers.phoneNumber=${phone}`,
      `phoneNumbers.phoneNumber==${phone}`
    );
  }

  for (const filter of candidates) {
    try {
      const result = await cloverFetch(
        `/v3/merchants/${merchantId}/customers?expand=emailAddresses,phoneNumbers&limit=20&filter=${encodeURIComponent(filter)}`,
        { method: 'GET' },
        accessToken
      );

      const match = findMatchingCustomer(result.elements || [], { email, phone });
      if (match) return match;
    } catch (error) {
      // If a filter expression is not supported by Clover, try the next strategy.
      if (error.status === 401 || error.status === 403) throw error;
    }
  }

  // Fallback for small customer lists / unclear filter syntax.
  const result = await cloverFetch(
    `/v3/merchants/${merchantId}/customers?expand=emailAddresses,phoneNumbers&limit=200`,
    { method: 'GET' },
    accessToken
  );

  return findMatchingCustomer(result.elements || [], { email, phone });
}

function findMatchingCustomer(customers, { email, phone }) {
  return customers.find(customer => {
    const emails = customer.emailAddresses?.elements || customer.emailAddresses || [];
    const phones = customer.phoneNumbers?.elements || customer.phoneNumbers || [];

    const emailMatch = email && emails.some(entry => normalizeEmail(entry.emailAddress) === email);
    const phoneMatch = phone && phones.some(entry => normalizePhone(entry.phoneNumber) === phone);

    return emailMatch || phoneMatch;
  }) || null;
}

async function createCloverCustomer({ merchantId, accessToken, customerName, email, phone }) {
  const { firstName, lastName } = splitName(customerName);

  const customer = await cloverFetch(
    `/v3/merchants/${merchantId}/customers`,
    {
      method: 'POST',
      body: JSON.stringify({
        firstName,
        lastName,
        marketingAllowed: false
      })
    },
    accessToken
  );

  await ensureCustomerContactDetails({
    merchantId,
    accessToken,
    customer,
    email,
    phone
  });

  return cloverFetch(
    `/v3/merchants/${merchantId}/customers/${customer.id}?expand=emailAddresses,phoneNumbers`,
    { method: 'GET' },
    accessToken
  );
}

async function ensureCustomerContactDetails({ merchantId, accessToken, customer, email, phone }) {
  if (!customer?.id) return;

  const emails = customer.emailAddresses?.elements || customer.emailAddresses || [];
  const phones = customer.phoneNumbers?.elements || customer.phoneNumbers || [];

  const hasEmail = email && emails.some(entry => normalizeEmail(entry.emailAddress) === email);
  const hasPhone = phone && phones.some(entry => normalizePhone(entry.phoneNumber) === phone);

  if (email && !hasEmail) {
    await ignoreDuplicateOrPermissionError(() => cloverFetch(
      `/v3/merchants/${merchantId}/customers/${customer.id}/email_addresses`,
      {
        method: 'POST',
        body: JSON.stringify({
          emailAddress: email,
          primaryEmail: true
        })
      },
      accessToken
    ));
  }

  if (phone && !hasPhone) {
    await ignoreDuplicateOrPermissionError(() => cloverFetch(
      `/v3/merchants/${merchantId}/customers/${customer.id}/phone_numbers`,
      {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: phone
        })
      },
      accessToken
    ));
  }
}

async function ignoreDuplicateOrPermissionError(callback) {
  try {
    await callback();
  } catch (error) {
    // Customer contact additions should not block checkout.
    if (![400, 401, 403, 409].includes(Number(error.status))) {
      throw error;
    }
  }
}

async function attachCustomerToOrder({ merchantId, accessToken, orderId, customerId }) {
  if (!merchantId || !accessToken || !orderId || !customerId) {
    return {
      success: false,
      skipped: true,
      reason: 'Missing order or customer id'
    };
  }

  try {
    const updatedOrder = await cloverFetch(
      `/v3/merchants/${merchantId}/orders/${orderId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          customers: [{ id: customerId }]
        })
      },
      accessToken
    );

    return {
      success: true,
      customerId,
      orderId: updatedOrder.id || orderId
    };
  } catch (error) {
    return {
      success: false,
      skipped: true,
      customerId,
      reason: 'Unable to attach customer to order',
      status: error.status || null,
      message: error.message
    };
  }
}

async function getCloverOrder({ merchantId, accessToken, orderId }) {
  if (!merchantId || !accessToken || !orderId) return null;

  try {
    return await cloverFetch(
      `/v3/merchants/${merchantId}/orders/${encodeURIComponent(orderId)}?expand=lineItems`,
      { method: 'GET' },
      accessToken
    );
  } catch (error) {
    return null;
  }
}

function buildCheckoutTotals({ cart, cloverOrder }) {
  const subtotal = calculateCartSubtotal(cart);
  const total = Number(cloverOrder?.total || 0) || subtotal;
  const tax = Math.max(0, total - subtotal);

  return {
    subtotal,
    tax,
    total
  };
}

function calculateCartSubtotal(cart) {
  if (!Array.isArray(cart)) return 0;

  return cart.reduce((sum, cartItem) => {
    const quantity = Number(cartItem.quantity || 1);
    const basePrice = Number(cartItem.price || 0);
    const modifierTotal = (Array.isArray(cartItem.modifiers) ? cartItem.modifiers : [])
      .reduce((total, modifier) => total + Number(modifier.price || 0), 0);

    return sum + ((basePrice + modifierTotal) * quantity);
  }, 0);
}

function buildLineItem(cartItem) {
  const modifiers = Array.isArray(cartItem.modifiers) ? cartItem.modifiers : [];

  const noteParts = [
    cartItem.note ? `Item note: ${cartItem.note}` : ''
  ].filter(Boolean);

  const lineItem = {
    item: { id: cartItem.id }
  };

  const modifications = modifiers
    .filter(modifier => modifier && modifier.id)
    .map(modifier => ({
      modifier: {
        id: modifier.id
      }
    }));

  if (modifications.length) {
    lineItem.modifications = modifications;
  }

  if (noteParts.length) {
    lineItem.note = noteParts.join('\n');
  }

  return lineItem;
}

function buildOrderNote({ customerName, phone, email, orderNotes, customerSync }) {
  return [
    'Website order',
    customerName ? `Name: ${customerName}` : '',
    phone ? `Phone: ${phone}` : '',
    email ? `Email: ${email}` : '',
    customerSync?.customer?.id ? `Clover customer: ${customerSync.customer.id}` : '',
    orderNotes ? `Notes: ${orderNotes}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function splitName(name) {
  const parts = String(name || 'Guest').trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return { firstName: 'Website', lastName: 'Guest' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email && email.includes('@') ? email : '';
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';

  // Store US numbers in a predictable 10-digit format for easier matching.
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function sanitizeCustomer(customer) {
  if (!customer) return null;

  return {
    id: customer.id,
    firstName: customer.firstName || '',
    lastName: customer.lastName || ''
  };
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
