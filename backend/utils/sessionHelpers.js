/**
 * Shared FitPrime session helpers.
 *
 * Two responsibilities, kept here so the check-in, status, and admin-adjust
 * handlers can never drift out of sync:
 *
 *   1. expireIfDue(member)        - lazy expiry of a member's active session.
 *                                   MUST run before any gate evaluation.
 *   2. evaluateCheckInGates(...)  - the no-session / active-session / cooldown
 *                                   gate checks, returning a precise HTTP error.
 *
 * The actual check-in decrement is done atomically via attemptCheckIn() using a
 * conditional prisma updateMany so a double-tap / retry can never double-decrement.
 */
const prisma = require('../config/prisma');
const { COOLDOWN_MS } = require('../config/constants');

/**
 * Lazily expire a member's active session if its end time has passed.
 *
 * This closes the gap between "session ended by the clock" and "cron tick marked
 * it expired" (up to 60s). It is idempotent: if there's nothing to expire or it
 * has already been expired, it does nothing.
 *
 * Accepts a raw member row (plain object from prisma) and writes back through
 * prisma. Returns the (possibly updated) member row.
 */
const expireIfDue = async (member) => {
  if (!member) return member;
  const now = new Date();
  const endsAt = member.currentSessionEndsAt ? new Date(member.currentSessionEndsAt) : null;

  // No active session, or the active one hasn't ended yet.
  if (!endsAt || endsAt > now) return member;

  // Active session has ended by the clock but not yet recorded. Expire inline.
  // Use a conditional updateMany so concurrent expiries don't double-process:
  // only the request that still sees currentSessionEndsAt = endsAt wins.
  const updated = await prisma.member.updateMany({
    where: { id: member.id, currentSessionEndsAt: endsAt },
    data: {
      currentSessionEndsAt: null,
      currentSessionGymId: null,
    },
  });

  // Mark the SessionCheckIn row expired too (best-effort; cron also does this).
  await prisma.sessionCheckIn.updateMany({
    where: { memberId: member.id, status: 'active', expiresAt: endsAt },
    data: { status: 'expired' },
  }).catch(() => { /* cron will reconcile; never fatal */ });

  if (updated.count > 0) {
    member.currentSessionEndsAt = null;
    member.currentSessionGymId = null;
  }
  return member;
};

/**
 * Evaluate the three check-in gates against a member (assumed already lazily
 * expired via expireIfDue). Returns null if all gates pass, otherwise an object
 * describing the precise HTTP error to return.
 *
 *   sessionsRemaining <= 0      -> 402 "no sessions"
 *   active session not ended    -> 409 "session already active"
 *   within cooldown window      -> 429 "cooldown active" (+ cooldownEndsAt)
 */
const evaluateCheckInGates = (member) => {
  const now = new Date();

  if (!member) {
    return { code: 404, message: 'Member not found' };
  }

  // Gate 1: active session still running (should be rare post-expireIfDue,
  // but covers the case where the member genuinely has time left).
  if (member.currentSessionEndsAt && new Date(member.currentSessionEndsAt) > now) {
    return {
      code: 409,
      message: 'You already have an active session.',
      sessionEndsAt: member.currentSessionEndsAt,
    };
  }

  // Gate 2: no sessions remaining.
  if (!member.sessionsRemaining || member.sessionsRemaining <= 0) {
    return { code: 402, message: 'No sessions remaining. Please purchase a plan to check in.' };
  }

  // Gate 3: global cooldown (measured from session END).
  if (member.cooldownEndsAt && new Date(member.cooldownEndsAt) > now) {
    return {
      code: 429,
      message: 'Cooldown active. You can check in again after the cooldown ends.',
      cooldownEndsAt: member.cooldownEndsAt,
      retryAfter: Math.ceil((new Date(member.cooldownEndsAt) - now) / 1000),
    };
  }

  return null; // all gates passed
};

/**
 * Atomically attempt a check-in for a member at a given gym.
 *
 * The decrement + session-field updates happen inside a SINGLE conditional
 * updateMany guarded by `sessionsRemaining >= 1` AND `currentSessionEndsAt IS null`.
 * If two requests race (double-tap, flaky-network retry), only one will see
 * count === 1; the other gets count === 0 and we re-read to return the precise
 * reason (the loser will typically trip the active-session or cooldown gate).
 *
 * Returns { ok: true, member, sessionCheckIn } on success, or
 *         { ok: false, gate } where `gate` is an evaluateCheckInGates() result.
 *
 * @param {object} member - lazily-expired member row
 * @param {object} gym    - gym row whose QR was scanned (must have defaultSessionDurationMinutes)
 */
const attemptCheckIn = async (member, gym, branch = null) => {
  const now = new Date();
  const durationMinutes = gym.defaultSessionDurationMinutes || 120;
  const coinSettings = await prisma.coinSettings.findUnique({ where: { division: 'fitpass' } }).catch(() => null);
  const coinsPerSession = coinSettings?.coinsPerSession || 10;
  // One-time compatibility conversion for existing FitPass members when the
  // new coin columns are introduced. The remaining session allotment survives.
  if (!member.coinsMigrated && (member.sessionsRemaining || 0) > 0) {
    const converted = await prisma.member.updateMany({ where: { id: member.id, coinsMigrated: false }, data: { fitpassCoins: (member.fitpassCoins || 0) + (member.sessionsRemaining || 0) * coinsPerSession, coinsMigrated: true } });
    if (converted.count) { member.fitpassCoins = (member.fitpassCoins || 0) + (member.sessionsRemaining || 0) * coinsPerSession; member.coinsMigrated = true; }
  } else if (!member.coinsMigrated) {
    await prisma.member.updateMany({ where: { id: member.id, coinsMigrated: false }, data: { coinsMigrated: true } });
    member.coinsMigrated = true;
  }
  const sessionEndsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const cooldownEndsAt = new Date(sessionEndsAt.getTime() + COOLDOWN_MS);

  // Conditional, atomic update. The WHERE clause IS the lock: it only matches
  // a member who still has a session to spend, has no active session, AND is not
  // in cooldown. All three gates must hold atomically so a double-tap / retry /
  // just-expired-session can never bypass the cooldown or double-decrement.
  // (cooldownEndsAt is null OR in the past -> NOT in cooldown right now.)
  const result = await prisma.member.updateMany({
    where: {
      id: member.id,
      sessionsRemaining: { gte: 1 },
      fitpassCoins: { gte: coinsPerSession },
      currentSessionEndsAt: null,
      OR: [
        { cooldownEndsAt: null },
        { cooldownEndsAt: { lt: now } },
      ],
    },
    data: {
      sessionsRemaining: { decrement: 1 },
      fitpassCoins: { decrement: coinsPerSession },
      lastCheckInAt: now,
      currentSessionEndsAt: sessionEndsAt,
      currentSessionGymId: gym.id,
      cooldownEndsAt,
    },
  });

  if (result.count === 0) {
    // We lost the race OR a gate failed. Re-read fresh state and report why.
    const fresh = await prisma.member.findUnique({ where: { id: member.id } });
    const expired = await expireIfDue(fresh);
    const gate = evaluateCheckInGates(expired);
    return { ok: false, gate: gate || { code: 409, message: 'Check-in could not be completed. Please try again.' } };
  }

  // We won the race. Record the audit-grade check-in row.
  const sessionCheckIn = await prisma.sessionCheckIn.create({
    data: {
      memberId: member.id,
      gymId: gym.id,
      gymName: gym.name || '',
      branchId: branch ? branch.id : null,
      branchName: branch ? branch.name || '' : '',
      startedAt: now,
      expiresAt: sessionEndsAt,
      status: 'active',
    },
  });

  let updatedMember = await prisma.member.findUnique({ where: { id: member.id } });

  if (updatedMember && updatedMember.sessionsRemaining <= 0) {
    updatedMember = await prisma.member.update({
      where: { id: member.id },
      data: { status: 'Expired' }
    });
  }

  return { ok: true, member: updatedMember, sessionCheckIn, sessionEndsAt, cooldownEndsAt };
};

module.exports = { expireIfDue, evaluateCheckInGates, attemptCheckIn };
