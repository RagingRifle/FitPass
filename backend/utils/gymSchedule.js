const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timeParts = (date, timeZone = 'Asia/Kolkata') => {
  try {
    return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  } catch {
    return timeParts(date, 'Asia/Kolkata');
  }
};

const dateKey = (date, timeZone = 'Asia/Kolkata') => {
  const parts = timeParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getWeeklySchedule = (profile = {}) => {
  const existing = profile.weeklySchedule;
  if (existing && typeof existing === 'object' && !Array.isArray(existing) && Object.keys(existing).length) return existing;
  const workingDays = Array.isArray(profile.workingDays) ? profile.workingDays : DAY_NAMES;
  return Object.fromEntries(DAY_NAMES.map(day => [day, {
    closed: !workingDays.includes(day),
    open: profile.openingTime || '06:00 AM',
    close: profile.closingTime || '10:00 PM',
  }]));
};

const getEffectiveHours = (profile = {}, date = new Date()) => {
  const key = dateKey(date, profile.timeZone || 'Asia/Kolkata');
  const exceptions = Array.isArray(profile.scheduleExceptions) ? profile.scheduleExceptions : [];
  const exception = exceptions.find(item => item?.date === key);
  if (exception) return { ...exception, isException: true };
  const day = timeParts(date, profile.timeZone || 'Asia/Kolkata').weekday;
  const weekly = getWeeklySchedule(profile)[day] || {};
  return {
    date: key,
    day,
    closed: Boolean(weekly.closed),
    open: weekly.open || weekly.openingTime || profile.openingTime || '06:00 AM',
    close: weekly.close || weekly.closingTime || profile.closingTime || '10:00 PM',
    reason: '',
    isException: false,
  };
};

const parseMinutes = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const twelveHour = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toUpperCase() === 'PM') hours += 12;
    return hours * 60 + Number(twelveHour[2]);
  }
  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);
  return null;
};

const isOpenAt = (profile = {}, date = new Date()) => {
  const hours = getEffectiveHours(profile, date);
  if (hours.closed) return false;
  const open = parseMinutes(hours.open);
  const close = parseMinutes(hours.close);
  if (open === null || close === null) return false;
  const parts = timeParts(date, profile.timeZone || 'Asia/Kolkata');
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  return open <= close ? current >= open && current <= close : current >= open || current <= close;
};

module.exports = { DAY_NAMES, dateKey, getWeeklySchedule, getEffectiveHours, isOpenAt };
