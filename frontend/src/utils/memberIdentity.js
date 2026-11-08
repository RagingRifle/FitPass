export const dedupeMemberRecords = (items = []) => {
  const unique = new Map();
  items.forEach(member => {
    const email = String(member.email || '').trim().toLowerCase();
    const phone = String(member.phone || '').replace(/\D/g, '');
    const key = email
      ? `email:${email}`
      : phone
        ? `phone:${phone}:${String(member.name || '').trim().toLowerCase()}`
        : `id:${member.id || member._id}`;
    const previous = unique.get(key);
    if (!previous || (member.status === 'Active' && previous.status !== 'Active')) unique.set(key, member);
  });
  return [...unique.values()];
};
