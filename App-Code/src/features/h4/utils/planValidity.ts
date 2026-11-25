const DAY_IN_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addCalendarMonths = (date: Date, months: number) => {
  const monthIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
};

const calendarDaysBetween = (start: Date, end: Date) => {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / DAY_IN_MS);
};

const formatDuration = (months: number, days: number) => {
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : '0 days';
};

export const getPlanValidity = (expiryDate?: string | null, today = new Date()) => {
  if (!expiryDate) {
    return {
      expiryLabel: 'Validity date unavailable',
      remainingLabel: 'Please contact the H4 front desk',
      isExpired: false,
    };
  }

  const parsedExpiry = new Date(expiryDate);
  if (Number.isNaN(parsedExpiry.getTime())) {
    return {
      expiryLabel: 'Validity date unavailable',
      remainingLabel: 'Please contact the H4 front desk',
      isExpired: false,
    };
  }

  const todayDate = startOfDay(today);
  const expiryDay = startOfDay(parsedExpiry);
  const isExpired = expiryDay < todayDate;
  const start = isExpired ? expiryDay : todayDate;
  const end = isExpired ? todayDate : expiryDay;

  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (addCalendarMonths(start, months) > end) months -= 1;
  const days = calendarDaysBetween(addCalendarMonths(start, months), end);
  const duration = formatDuration(months, days);

  return {
    expiryLabel: `${isExpired ? 'Expired on' : 'Valid until'} ${expiryDay.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
    remainingLabel: isExpired
      ? `${duration} ago`
      : duration === '0 days'
        ? 'Expires today'
        : `${duration} left`,
    isExpired,
  };
};
