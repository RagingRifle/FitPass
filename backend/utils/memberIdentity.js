const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const identityAliases = (member) => {
  const aliases = [];
  const linkedId = member.memberId || member.id || member._id;
  const email = normalizeEmail(member.email);
  const phone = normalizePhone(member.phone);
  const name = normalizeName(member.name);
  if (member.memberId) aliases.push(`member:${member.memberId}`);
  if (email) aliases.push(`email:${email}`);
  if (phone && name) aliases.push(`phone-name:${phone}:${name}`);
  if (!aliases.length && linkedId) aliases.push(`id:${linkedId}`);
  return aliases;
};

const isCurrentActive = (member, now) => member.status === 'Active'
  && (!member.expiryDate || new Date(member.expiryDate) > now);

const dedupeMembers = (records = []) => {
  const groups = [];
  const aliasToGroup = new Map();
  const now = new Date();

  records.forEach((record) => {
    const aliases = identityAliases(record);
    const matchingGroups = [...new Set(aliases.map(alias => aliasToGroup.get(alias)).filter(index => index !== undefined))];
    if (!matchingGroups.length) {
      const index = groups.length;
      groups.push(record);
      aliases.forEach(alias => aliasToGroup.set(alias, index));
      return;
    }

    const primaryIndex = matchingGroups[0];
    const existing = groups[primaryIndex];
    const candidateWins = Number(isCurrentActive(record, now)) > Number(isCurrentActive(existing, now))
      || (isCurrentActive(record, now) === isCurrentActive(existing, now)
        && new Date(record.updatedAt || record.createdAt || 0) > new Date(existing.updatedAt || existing.createdAt || 0));
    if (candidateWins) groups[primaryIndex] = record;

    matchingGroups.slice(1).forEach((otherIndex) => {
      const other = groups[otherIndex];
      if (other && (Number(isCurrentActive(other, now)) > Number(isCurrentActive(groups[primaryIndex], now)))) {
        groups[primaryIndex] = other;
      }
      groups[otherIndex] = null;
      aliasToGroup.forEach((index, alias) => { if (index === otherIndex) aliasToGroup.set(alias, primaryIndex); });
    });
    aliases.forEach(alias => aliasToGroup.set(alias, primaryIndex));
  });

  return groups.filter(Boolean);
};

module.exports = { dedupeMembers };
