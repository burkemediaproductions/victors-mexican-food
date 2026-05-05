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
  const manualToggle = parseBooleanEnv(
    process.env.CLOVER_ONLINE_ORDERING_ENABLED ??
      process.env.ORDERING_ENABLED ??
      process.env.ONLINE_ORDERING_ENABLED
  );

  const daysRaw =
    process.env.ONLINE_ORDERING_DAYS ??
    process.env.ONLINE_ORDERING_DAY ??
    process.env.CLOVER_ONLINE_ORDERING_DAYS ??
    process.env.CLOVER_ONLINE_ORDERING_DAY ??
    '';

  const timeRaw =
    process.env.ONLINE_ORDERING_TIME ??
    process.env.ONLINE_ORDERING_HOURS ??
    process.env.CLOVER_ONLINE_ORDERING_TIME ??
    process.env.CLOVER_ONLINE_ORDERING_HOURS ??
    '';

  const timezone =
    process.env.ONLINE_ORDERING_TIMEZONE ||
    process.env.ORDERING_TIMEZONE ||
    process.env.BUSINESS_TIMEZONE ||
    'America/Los_Angeles';

  const schedule = getOrderingScheduleStatus({ daysRaw, timeRaw, timezone });

  let orderingAvailable;
  let orderingSource;
  let closedReason = '';

  if (manualToggle === false) {
    orderingAvailable = false;
    orderingSource = 'manual-off';
    closedReason = 'manual';
  } else if (schedule.hasSchedule) {
    orderingAvailable = schedule.available;
    orderingSource = 'schedule';
    closedReason = schedule.reason || '';
  } else {
    orderingAvailable = manualToggle === null ? true : manualToggle;
    orderingSource = manualToggle === null ? 'default' : 'manual-on';
  }

  return {
    orderingAvailable,
    orderingSource,
    orderingMessage: orderingAvailable
      ? ''
      : getOrderingClosedMessage(schedule, closedReason),
    orderingSchedule: {
      enabledDays: schedule.enabledDays,
      timeRange: schedule.timeRangeLabel,
      timezone,
      currentDay: schedule.currentDay,
      currentTime: schedule.currentTimeLabel,
      reason: closedReason
    }
  };
}

function getOrderingScheduleStatus({ daysRaw, timeRaw, timezone }) {
  const enabledDays = parseOrderingDays(daysRaw);
  const timeRange = parseOrderingTimeRange(timeRaw);
  const businessNow = getBusinessDateParts(timezone);

  const hasDaySchedule = enabledDays.length > 0;
  const hasTimeSchedule = Boolean(timeRange);
  const hasSchedule = hasDaySchedule || hasTimeSchedule;

  const dayAllowed = !hasDaySchedule || enabledDays.includes(businessNow.weekdayKey);
  const timeAllowed = !hasTimeSchedule || isMinuteInRange(
    businessNow.minutesSinceMidnight,
    timeRange.startMinutes,
    timeRange.endMinutes
  );

  let reason = '';
  if (!dayAllowed) reason = 'day';
  else if (!timeAllowed) reason = 'time';

  return {
    hasSchedule,
    available: dayAllowed && timeAllowed,
    reason,
    enabledDays,
    timeRangeLabel: timeRange ? timeRange.label : '',
    currentDay: businessNow.weekdayName,
    currentTimeLabel: businessNow.timeLabel
  };
}

function parseOrderingDays(value) {
  if (!value) return [];

  const aliases = {
    sunday: 'sunday',
    sun: 'sunday',
    monday: 'monday',
    mon: 'monday',
    tuesday: 'tuesday',
    tue: 'tuesday',
    tues: 'tuesday',
    wednesday: 'wednesday',
    wed: 'wednesday',
    weds: 'wednesday',
    thursday: 'thursday',
    thu: 'thursday',
    thur: 'thursday',
    thurs: 'thursday',
    friday: 'friday',
    fri: 'friday',
    saturday: 'saturday',
    sat: 'saturday'
  };

  const normalized = String(value).trim().toLowerCase();

  if (['all', 'daily', 'everyday', 'every day', '7 days', 'seven days'].includes(normalized)) {
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  }

  if (['weekdays', 'weekday', 'monday-friday', 'mon-fri', 'monday through friday'].includes(normalized)) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }

  if (['weekends', 'weekend', 'saturday-sunday', 'sat-sun'].includes(normalized)) {
    return ['saturday', 'sunday'];
  }

  return String(value)
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .map((part) => aliases[part] || '')
    .filter(Boolean)
    .filter((day, index, days) => days.indexOf(day) === index);
}

function parseOrderingTimeRange(value) {
  if (!value) return null;

  const parts = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const startMinutes = parseTimeToMinutes(parts[0]);
  const endMinutes = parseTimeToMinutes(parts[1]);

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return null;

  return {
    startMinutes,
    endMinutes,
    label: `${formatMinutesAsTime(startMinutes)}-${formatMinutesAsTime(endMinutes)}`
  };
}

function parseTimeToMinutes(value) {
  const input = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?(a|am|p|pm)?$/);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3] || '';

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem.startsWith('a')) {
      if (hour === 12) hour = 0;
    } else if (meridiem.startsWith('p')) {
      if (hour !== 12) hour += 12;
    }
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function isMinuteInRange(currentMinutes, startMinutes, endMinutes) {
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // Supports overnight windows like 8pm,2am.
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function getBusinessDateParts(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());

    const weekdayName = parts.find((part) => part.type === 'weekday')?.value || '';
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    const minutesSinceMidnight = hour * 60 + minute;

    return {
      weekdayName,
      weekdayKey: weekdayName.toLowerCase(),
      minutesSinceMidnight,
      timeLabel: formatMinutesAsTime(minutesSinceMidnight)
    };
  } catch (error) {
    const now = new Date();
    const weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

    return {
      weekdayName,
      weekdayKey: weekdayName.toLowerCase(),
      minutesSinceMidnight,
      timeLabel: formatMinutesAsTime(minutesSinceMidnight)
    };
  }
}

function formatMinutesAsTime(totalMinutes) {
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  const minuteText = minute ? `:${String(minute).padStart(2, '0')}` : '';

  return `${hour12}${minuteText} ${suffix}`;
}

function getOrderingClosedMessage(schedule, reason) {
  const customMessage = process.env.CLOVER_ORDERING_DISABLED_MESSAGE || process.env.ONLINE_ORDERING_DISABLED_MESSAGE;
  if (customMessage) return customMessage;

  if (reason === 'manual') {
    return 'Online ordering is currently unavailable. You can still browse the menu, then call us to order.';
  }

  const scheduleParts = [];

  if (schedule.enabledDays.length) {
    scheduleParts.push(formatDayList(schedule.enabledDays));
  }

  if (schedule.timeRangeLabel) {
    scheduleParts.push(schedule.timeRangeLabel);
  }

  if (scheduleParts.length) {
    return `Online ordering is available ${scheduleParts.join(' from ')}. You can still browse the menu, then call us to order.`;
  }

  return 'Online ordering is currently unavailable. You can still browse the menu, then call us to order.';
}

function formatDayList(days) {
  const labels = days.map((day) => day.charAt(0).toUpperCase() + day.slice(1));

  if (labels.length === 7) return 'daily';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return labels.join(' and ');

  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
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
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}