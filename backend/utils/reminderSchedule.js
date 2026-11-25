const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getUtcDayNumber = (date) => Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
) / DAY_IN_MS);

const getDaysUntil = (date, today = new Date()) => (
    getUtcDayNumber(date) - getUtcDayNumber(today)
);

const getDaysSince = (date, today = new Date()) => (
    getUtcDayNumber(today) - getUtcDayNumber(date)
);

const getUtcDateKey = (date) => date.toISOString().slice(0, 10);

const createReminderDedupeKey = ({ type, subjectId, recipientId, cycleKey, repeatDaily, today = new Date() }) => (
    [type, subjectId, recipientId, cycleKey, repeatDaily ? getUtcDateKey(today) : 'once'].join(':')
);

module.exports = {
    createReminderDedupeKey,
    getDaysSince,
    getDaysUntil,
    getUtcDateKey,
};
