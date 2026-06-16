const CLOVER_API_BASE =
  process.env.CLOVER_ENV === 'sandbox'
    ? 'https://sandbox.dev.clover.com'
    : 'https://api.clover.com';

const CLOVER_PAGE_LIMIT = 1000;

const HIDDEN_MODIFIER_NAMES = new Set([
  '1 tortilla',
  '2 nd taco fish',
  '2nd taco shrimp',
  'a la diabla',
  'add milanesa',
  'add rice to burrito',
  'al mojo de ajo',
  'combinada',
  'con cilantro',
  'con papa',
  'con pico',
  'con queso',
  'costumer 1',
  'costumer 2',
  'costumer 3',
  'customer 1',
  'customer 2',
  'customer 3',
  'extra arroz',
]);

const HIDDEN_MODIFIER_GROUP_RULES = [
  { name: 'add fries', groups: ['kids menu'] },
  { name: 'add meat', groups: ['kids menu'] },
  { name: 'asada', groups: ['carnes'] },
  { name: 'bean and cheese only', groups: ['fries modifiers'] },
  { name: 'birria', groups: ['carnes'] },
  { name: 'cabeza', groups: ['carnes'] },
  { name: 'carnitas', groups: ['carnes'] },
  { name: 'chicken', groups: ['carnes'] },
  { name: 'chile relleno', groups: ['carnes'] },
  { name: 'chile verde', groups: ['carnes'] },
  { name: 'chorizo', groups: ['carnes'] },
  { name: 'con cebolla', groups: ['kids menu modifier'] },
  { name: 'extra 1 egg', groups: ['burrito modifier'] },
  { name: 'extra 2 egg', groups: ['burrito modifier'] },
  { name: 'extra cheese', groups: ['fries modifiers', 'kids menu modifier', 'nachos modifier', 'sopes modifier'] },
  { name: 'extra frijol', groups: ['tacos no'] },
  { name: 'extra meat', groups: ['fries modifiers'] },
  { name: 'fries', groups: ['extras modifiers'] },
  { name: 'green sauce', groups: ['kids menu modifier'] },
  { name: 'grilled onions', groups: ['torta modifier'] },
  { name: 'hardshell beef', groups: ['taco and enchilada mod'] },
  { name: 'hardshell chicken', groups: ['taco and enchilada mod'] },
  { name: 'hardshell potato', groups: ['taco and enchilada mod'] },
  { name: 'harina', groups: ['marisco'] },
  { name: 'kids al pastor taco', groups: ['kids menu modifier'] },
  { name: 'kids asada taco', groups: ['kids menu modifier'] },
  { name: 'kids birria taco', groups: ['kids menu modifier'] },
  { name: 'kids carnitas taco', groups: ['kids menu modifier'] },
  { name: 'kids chicken enchilada', groups: ['kids menu modifier'] },
  { name: 'kids chicken taco', groups: ['kids menu modifier'] },
  { name: 'ligth cheese', groups: ['quesadilla modifier'] },
  { name: 'maiz', groups: ['marisco'] },
  { name: 'no beans', groups: ['fries modifiers', 'kids menu modifier', 'kids modifier'] },
  { name: 'no cabbage', groups: ['2 taco plate 2nd taco'] },
  { name: 'no cheese', groups: ['fries modifiers', 'kids menu modifier', 'taco no'] },
  { name: 'no chipoltle', groups: ['2 taco plate 2nd taco'] },
  { name: 'no cila tro', groups: ['2 taco plate 2nd taco', 'taco no'] },
  { name: 'no cilantro', groups: ['fries modifiers'] },
  { name: 'no guacamole', groups: ['fries modifiers'] },
  { name: 'no onion', groups: ['taco no'] },
  { name: 'no onions', groups: ['fries modifiers'] },
  { name: 'no pico', groups: ['2 taco plate 2nd taco', 'fries modifiers', 'taco no'] },
  { name: 'no rice', groups: ['kids menu modifier', 'kids modifier'] },
  { name: 'no salsa', groups: ['taco no'] },
  { name: 'no sour cream', groups: ['fries modifiers'] },
  { name: 'no tomato', groups: ['fries modifiers', 'taco no'] },
  { name: 'no tortilla', groups: ['marisco', 'taco no'] },
  { name: 'pastor', groups: ['carnes'] },
  { name: 'plain', groups: ['kids menu modifier'] },
  { name: 'red sauce', groups: ['kids menu modifier'] },
  { name: 'res nachos', groups: ['meats'] },
  { name: 'rice and beans plate', groups: ['burrito modifier'] },
  { name: 'side of fries', groups: ['combo modifiers'] },
  { name: 'solo carne fries queso y crema', groups: ['burrito modifier'] },
];

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
        .filter((group) => isOnlineEntityEnabled(group) && !isInternalHiddenModifierGroup(group))
        .map((group) => {
          const modifiers = (group.modifiers?.elements || [])
            .filter((modifier) =>
              isOnlineEntityEnabled(modifier) &&
              !isInternalHiddenModifier(modifier, group)
            )
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

function normalizeOnlineName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}


function isInternalHiddenModifier(modifier, group) {
  const modifierName = normalizeOnlineName(getOnlineName(modifier) || modifier?.name || '');
  const groupName = normalizeOnlineName(getOnlineName(group) || group?.name || '');

  if (!modifierName) return true;
  if (/^-+$/.test(String(modifier?.name || '').replace(/\s+/g, ''))) return true;
  if (!/[a-z0-9]/i.test(String(modifier?.name || ''))) return true;
  if (modifierName.includes('refill')) return true;

  if (HIDDEN_MODIFIER_NAMES.has(modifierName)) return true;

  return HIDDEN_MODIFIER_GROUP_RULES.some((rule) => {
    if (rule.name !== modifierName) return false;

    return rule.groups.some((targetGroupName) =>
      groupName === targetGroupName ||
      groupName.includes(targetGroupName) ||
      targetGroupName.includes(groupName)
    );
  });
}

function isInternalHiddenModifierGroup(group) {
  const name = normalizeOnlineName(getOnlineName(group) || group?.name || '');

  // Clover's online menu hides internal "No" groups when their options are not set to show online.
  // The API response we receive does not always expose that per-option online flag, so this mirrors
  // Clover Online Ordering for groups like "Taco No" while still allowing normal groups like "Taco Modifier".
  return /\bno$/.test(name);
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

async function getCloverMenu() {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const accessToken = process.env.CLOVER_ACCESS_TOKEN;

  if (!merchantId || !accessToken) {
    throw new Error('Missing CLOVER_MERCHANT_ID or CLOVER_ACCESS_TOKEN');
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

  return {
    ...normalized,
    ...orderingAvailability
  };
}

module.exports = {
  getCloverMenu,
  normalizeMenu,
  formatMoney
};
