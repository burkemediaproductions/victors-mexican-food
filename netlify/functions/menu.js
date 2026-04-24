const CLOVER_API_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://sandbox.dev.clover.com'
    : 'https://api.clover.com';

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
      cloverFetch(`/v3/merchants/${merchantId}/categories`, headers),
      cloverFetch(`/v3/merchants/${merchantId}/items?expand=categories,modifierGroups`, headers),
      cloverFetch(`/v3/merchants/${merchantId}/modifier_groups?expand=modifiers`, headers)
    ]);

    const normalized = normalizeMenu({
      categories: categories.elements || [],
      items: items.elements || [],
      modifierGroups: modifierGroups.elements || []
    });

    return json(200, normalized);
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

function normalizeMenu({ categories, items, modifierGroups }) {
  const modifierGroupMap = new Map(
    modifierGroups.map((group) => [group.id, group])
  );

  const activeItems = items
    .filter((item) => !item.hidden && item.available !== false)
    .map((item) => {
      const itemCategoryIds = (item.categories?.elements || []).map((cat) => cat.id);

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
    items: activeItems.filter((item) => item.categoryIds.includes(category.id))
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