const DEFAULT_TIME_ZONE = 'America/Los_Angeles';
const DEFAULT_CLOSURE_START = '2026-08-02';
const DEFAULT_CLOSURE_END = '2026-08-21';

const DAY_ALIASES = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6
};

function getOrderingAvailability(date = new Date(), env = process.env) {
  const explicit = parseBoolean(
    env.CLOVER_ONLINE_ORDERING_ENABLED ??
      env.ORDERING_ENABLED ??
      env.ONLINE_ORDERING_ENABLED
  );

  if (explicit === false) {
    return closedResult(env, 'environment');
  }

  const allowedDays = parseDays(env.ONLINE_ORDERING_DAYS || env.ONLINE_ORDERING_DAY);
  const timeRange = parseTimeRange(env.ONLINE_ORDERING_HOURS || env.ONLINE_ORDERING_TIME);

  // Preserve the original always-on behavior when no schedule is configured.
  if (!allowedDays.length && !timeRange) {
    return {
      orderingAvailable: explicit === null ? true : explicit,
      orderingSource: explicit === null ? 'default' : 'environment',
      orderingMessage: ''
    };
  }

  const timeZone = env.ONLINE_ORDERING_TIMEZONE || DEFAULT_TIME_ZONE;
  const businessTime = getBusinessTime(date, timeZone);

  const closureStart = env.ONLINE_ORDERING_CLOSED_START || DEFAULT_CLOSURE_START;
  const closureEnd = env.ONLINE_ORDERING_CLOSED_END || DEFAULT_CLOSURE_END;
  if (isDateInInclusiveRange(businessTime.dateKey, closureStart, closureEnd)) {
    return closedResult(env, 'special-closure');
  }

  const dayAllowed = !allowedDays.length || allowedDays.includes(businessTime.day);
  const timeAllowed = !timeRange || isMinuteInRange(businessTime.minuteOfDay, timeRange);

  if (!dayAllowed || !timeAllowed) {
    return closedResult(env, 'schedule');
  }

  return {
    orderingAvailable: true,
    orderingSource: 'schedule',
    orderingMessage: ''
  };
}

function closedResult(env, source) {
  const defaultMessage = source === 'special-closure'
    ? 'Victor’s is closed for a family vacation from August 2 through August 21. We reopen Saturday, August 22. Online ordering will return when we reopen.'
    : 'Online ordering is currently closed. You can still browse the menu and return during our ordering hours.';

  return {
    orderingAvailable: false,
    orderingSource: source,
    orderingMessage:
      env.CLOVER_ORDERING_DISABLED_MESSAGE ||
      env.ONLINE_ORDERING_CLOSED_MESSAGE ||
      defaultMessage
  };
}

function getBusinessTime(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = DAY_ALIASES[String(values.weekday || '').toLowerCase()];
  const hour = Number(values.hour);
  const minute = Number(values.minute);

  if (!Number.isInteger(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Unable to determine ordering time in ${timeZone}`);
  }

  const year = Number(values.year);
  const month = Number(values.month);
  const calendarDay = Number(values.day);
  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(calendarDay).padStart(2, '0')}`;

  return { day, minuteOfDay: hour * 60 + minute, dateKey };
}

function isDateInInclusiveRange(dateKey, start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || ''))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(end || ''))) return false;
  return dateKey >= start && dateKey <= end;
}

function parseDays(value) {
  if (!value) return [];

  return [...new Set(String(value)
    .split(/[,|]/)
    .map(day => DAY_ALIASES[day.trim().toLowerCase()])
    .filter(Number.isInteger))];
}

function parseTimeRange(value) {
  if (!value) return null;
  const pieces = String(value).split(/[,|-]/).map(piece => piece.trim()).filter(Boolean);
  if (pieces.length !== 2) return null;

  const start = parseTime(pieces[0]);
  const end = parseTime(pieces[1]);
  if (start === null || end === null) return null;

  return { start, end };
}

function parseTime(value) {
  const match = String(value).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] || '';

  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === 'pm') hour += 12;
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function isMinuteInRange(minute, range) {
  if (range.start === range.end) return true;
  if (range.start < range.end) return minute >= range.start && minute < range.end;
  return minute >= range.start || minute < range.end;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'open', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off', 'closed', 'disabled'].includes(normalized)) return false;
  return null;
}

module.exports = {
  getOrderingAvailability,
  parseDays,
  parseTimeRange
};
