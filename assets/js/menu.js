const CLOVER_API_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://sandbox.dev.clover.com'
    : 'https://api.clover.com';

const CLOVER_PAGE_LIMIT = 1000;

exports.handler = async function () {
  try {
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const accessToken = process.env.CLOVER_ACCESS_TOKEN;

    if (!merchantId || !accessToken) {
      return json(500, {
        error: 'Missing CLOVER_MERCHANT_ID or CLOVER_ACCESS_TOKEN'
      });
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    };

    const [categories, items, modifierGroups] = await Promise.all([
      cloverFetchAll(`/v3/merchants/${merchantId}/categories`, headers),
      cloverFetchAll(
        `/v3/merchants/${merchantId}/items?expand=categories,modifierGroups`,
        headers
      ),
      cloverFetchAll(
        `/v3/merchants/${merchantId}/modifier_groups?expand=modifiers`,
        headers
      )
    ]);

    const normalized = normalizeMenu({
      categories: categories.elements || [],
      items: items.elements || [],
      modifierGroups: modifierGroups.elements || []
    });

    const orderingAvailability = getOrderingAvailability();

    return json(200, {
      ...normalized,
      ...orderingAvailability
    });
  } catch (error) {
    return json(500, {
      error: 'Unable to load Clover menu',
      message: error.message
    });
  }
};

async function cloverFetch(path, headers) {
  const response = await fetch(`${CLOVER_API_BASE}${path}`, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clover API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function cloverFetchAll(path, headers, limit = CLOVER_PAGE_LIMIT) {
  const elements = [];
  let offset = 0;

  while (true) {
    const pagePath = addPaginationParams(path, offset, limit);
    const page = await cloverFetch(pagePath, headers);
    const pageElements = Array.isArray(page.elements) ? page.elements : [];

    elements.push(...pageElements);

    if (pageElements.length < limit) break;

    offset += limit;
  }

  return { elements };
}

function addPaginationParams(path, offset, limit) {
  const [basePath, queryString = ''] = path.split('?');
  const params = new URLSearchParams(queryString);

  params.set('offset', String(offset));
  params.set('limit', String(limit));

  return `${basePath}?${params.toString()}`;
}

function normalizeMenu({ categories, items, modifierGroups }) {
  const modifierGroupMap = new Map(
    modifierGroups.map((group) => [group.id, group])
  );

  const activeItems = items
    .filter((item) => !item.hidden && item.available !== false)
    .map((item) => {
      const itemCategoryIds = (item.categories?.elements || []).map(
        (cat) => cat.id
      );

      const itemModifierGroups = (item.modifierGroups?.elements || [])
        .map((groupRef) => modifierGroupMap.get(groupRef.id) || groupRef)
        .map((group) => ({
          id: group.id,
          name: group.name,
          minRequired: group.minRequired || 0,
          maxAllowed: group.maxAllowed || null,
          modifiers: (group.modifiers?.elements || []).map((modifier) => ({
            id: modifier.id,
            name: modifier.name,
            price: modifier.price || 0
          }))
        }));

      return {
        id: item.id,
        name: item.name,
        description: item.description || '',
        price: item.price || 0,
        priceFormatted: formatMoney(item.price || 0),
        categoryIds: itemCategoryIds,
        modifierGroups: itemModifierGroups
      };
    });

  const menuCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder || 0,
    items: activeItems.filter((item) =>
      item.categoryIds.includes(category.id)
    )
  }));

  const uncategorizedItems = activeItems.filter(
    (item) => !item.categoryIds.length
  );

  if (uncategorizedItems.length) {
    menuCategories.push({
      id: 'uncategorized',
      name: 'Other Items',
      sortOrder: 999999,
      items: uncategorizedItems
    });
  }

  return {
    updatedAt: new Date().toISOString(),
    categories: menuCategories
      .filter((category) => category.items.length)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  };
}


function getOrderingAvailability() {
  const explicit = parseBooleanEnv(
    process.env.CLOVER_ONLINE_ORDERING_ENABLED ??
      process.env.ORDERING_ENABLED ??
      process.env.ONLINE_ORDERING_ENABLED
  );

  const orderingAvailable = explicit === null ? true : explicit;

  return {
    orderingAvailable,
    orderingSource: explicit === null ? 'default' : 'environment',
    orderingMessage: orderingAvailable
      ? ''
      : process.env.CLOVER_ORDERING_DISABLED_MESSAGE ||
        'Online ordering is currently unavailable. You can still browse the menu, then call us to order.'
  };
}

function parseBooleanEnv(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on', 'open', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off', 'closed', 'disabled'].includes(normalized)) return false;

  return null;
}

function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}