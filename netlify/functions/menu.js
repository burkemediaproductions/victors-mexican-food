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
    .filter((item) => isOnlineEntityEnabled(item))
    .map((item) => {
      const itemCategoryIds = (item.categories?.elements || []).map(
        (cat) => cat.id
      );

      const itemModifierGroups = (item.modifierGroups?.elements || [])
        .map((groupRef) => modifierGroupMap.get(groupRef.id) || groupRef)
        .filter((group) => isOnlineEntityEnabled(group))
        .map((group) => {
          const modifiers = (group.modifiers?.elements || [])
            .filter((modifier) => isOnlineEntityEnabled(modifier))
            .map((modifier) => {
              const modifierOnlineName = getOnlineName(modifier);
              const modifierCloverName = String(modifier.name || '').trim();

              return {
                id: modifier.id,
                name: modifierOnlineName || modifierCloverName,
                onlineName: modifierOnlineName,
                cloverName: modifierCloverName,
                price: modifier.price || 0
              };
            });

          return {
            id: group.id,
            name: getOnlineName(group) || group.name,
            cloverName: group.name || '',
            minRequired: group.minRequired || 0,
            maxAllowed: group.maxAllowed || null,
            modifiers
          };
        })
        .filter((group) => group.modifiers.length);

      const itemImage = getItemImage(item);
      const onlineName = getOnlineName(item);
      const cloverName = String(item.name || '').trim();
      const displayName = onlineName || cloverName;

      return {
        id: item.id,
        name: displayName,
        onlineName,
        cloverName,
        description: item.description || '',
        price: item.price || 0,
        priceFormatted: formatMoney(item.price || 0),
        categoryIds: itemCategoryIds,
        modifierGroups: itemModifierGroups,
        imageUrl: itemImage.url,
        hasImage: itemImage.hasImage
      };
    });

  const menuCategories = categories
    .filter((category) => isOnlineEntityEnabled(category))
    .map((category) => {
      const onlineName = getOnlineName(category);
      const cloverName = String(category.name || '').trim();

      return {
        id: category.id,
        name: onlineName || cloverName,
        onlineName,
        cloverName,
        sortOrder: category.sortOrder || 0,
        items: activeItems
          .filter((item) => item.categoryIds.includes(category.id))
          .sort(compareMenuItems)
      };
    });

  const uncategorizedItems = activeItems
    .filter((item) => !item.categoryIds.length)
    .sort(compareMenuItems);

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

function getOnlineName(entity) {
  const candidates = [
    entity?.onlineName,
    entity?.online_name,
    entity?.onlineDisplayName,
    entity?.onlineDisplayNameOverride,
    entity?.onlineCategoryName,
    entity?.onlineModifierGroupName,
    entity?.onlineModifierName,
    entity?.menuName,
    entity?.menu_name,
    entity?.displayName,
    entity?.alternateName
  ];

  const value = candidates.find(candidate => typeof candidate === 'string' && candidate.trim());
  return value ? value.trim() : '';
}

function isOnlineEntityEnabled(entity) {
  if (!entity) return false;

  if (entity.deleted === true || entity.isDeleted === true) return false;
  if (entity.hidden === true || entity.isHidden === true) return false;
  if (entity.available === false || entity.inStock === false) return false;

  const onlineFlags = [
    entity.enabledOnline,
    entity.showOnline,
    entity.online,
    entity.availableOnline,
    entity.isAvailableOnline,
    entity.visibleOnline,
    entity.showInOnlineOrdering,
    entity.onlineOrderingEnabled
  ];

  if (onlineFlags.some(value => value === false)) return false;

  const hiddenOnlineFlags = [
    entity.hiddenOnline,
    entity.isHiddenOnline,
    entity.hideOnline,
    entity.hideInOnlineOrdering
  ];

  if (hiddenOnlineFlags.some(value => value === true)) return false;

  return true;
}

function compareMenuItems(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
    sensitivity: 'base',
    numeric: true
  });
}



function getItemImage(item) {
  const directImageUrl = getDirectImageUrl(item);

  if (directImageUrl) {
    return {
      hasImage: true,
      url: directImageUrl
    };
  }

  if (hasCloverItemImage(item)) {
    return {
      hasImage: true,
      url: `/.netlify/functions/menu-image?itemId=${encodeURIComponent(item.id)}`
    };
  }

  return {
    hasImage: false,
    url: ''
  };
}

function getDirectImageUrl(item) {
  const candidates = [
    item.imageUrl,
    item.imageURL,
    item.image_url,
    item.photoUrl,
    item.photoURL,
    item.photo_url,
    item.pictureUrl,
    item.pictureURL,
    item.picture_url,
    item.image?.url,
    item.image?.href,
    item.images?.elements?.[0]?.url,
    item.images?.elements?.[0]?.href
  ];

  return candidates.find(value => typeof value === 'string' && /^https?:\/\//i.test(value.trim())) || '';
}

function hasCloverItemImage(item) {
  return Boolean(
    item.imageFilename ||
      item.imageFileName ||
      item.imageId ||
      item.image?.id ||
      item.images?.elements?.length ||
      item.hasImage === true
  );
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