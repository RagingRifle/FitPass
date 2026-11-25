const {
    createReminderDedupeKey,
    getDaysSince,
    getDaysUntil,
    getUtcDateKey,
} = require('../utils/reminderSchedule');

describe('reminder scheduling helpers', () => {
    const today = new Date('2026-11-25T10:00:00.000Z');

    it('calculates calendar days until a lead follow-up date', () => {
        expect(getDaysUntil(new Date('2026-11-27T00:00:00.000Z'), today)).toBe(2);
        expect(getDaysUntil(new Date('2026-11-24T00:00:00.000Z'), today)).toBe(-1);
    });

    it('calculates whole inactive days by calendar date', () => {
        expect(getDaysSince(new Date('2026-11-20T23:59:00.000Z'), today)).toBe(5);
    });

    it('uses stable once-only keys and distinct keys for daily repeats', () => {
        const base = { type: 'lead_followup', subjectId: 'lead-1', recipientId: 'user-1', cycleKey: '2026-11-27' };
        expect(createReminderDedupeKey({ ...base, repeatDaily: false, today }))
            .toBe(createReminderDedupeKey({ ...base, repeatDaily: false, today: new Date('2026-11-26T10:00:00.000Z') }));
        expect(createReminderDedupeKey({ ...base, repeatDaily: true, today }))
            .not.toBe(createReminderDedupeKey({ ...base, repeatDaily: true, today: new Date('2026-11-26T10:00:00.000Z') }));
        expect(getUtcDateKey(today)).toBe('2026-11-25');
    });
});
