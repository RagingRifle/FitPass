const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');

const getTickets = catchAsync(async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: req.user.role === 'member' ? { memberId: req.user.memberId } : { gymId: req.user.gymId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  res.json(tickets);
});

const createTicket = catchAsync(async (req, res) => {
  const { subject, category, message } = req.body || {};
  if (!subject?.trim() || !category?.trim() || !message?.trim()) return res.status(400).json({ message: 'Subject, topic, and message are required.' });
  if (req.user.role !== 'member' || !req.user.memberId) return res.status(403).json({ message: 'A linked member account is required to create a ticket.' });
  const member = await prisma.member.findUnique({ where: { id: req.user.memberId } });
  if (!member) return res.status(404).json({ message: 'Member profile not found.' });
  const ticket = await prisma.ticket.create({ data: {
    memberId: member.id, gymId: member.gymId, subject: subject.trim(), category: category.trim(),
    messages: { create: { senderId: req.user.id, senderName: req.user.name || member.name, message: message.trim() } },
  }, include: { messages: true } });
  res.status(201).json(ticket);
});

const replyToTicket = catchAsync(async (req, res) => {
  const message = req.body?.message?.trim();
  if (!message) return res.status(400).json({ message: 'Message is required.' });
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket || (req.user.role === 'member' ? ticket.memberId !== req.user.memberId : ticket.gymId !== req.user.gymId)) return res.status(404).json({ message: 'Ticket not found.' });
  if (['resolved', 'closed'].includes(ticket.status.toLowerCase())) return res.status(409).json({ message: 'This ticket is resolved.' });
  const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date(), messages: { create: { senderId: req.user.id, senderName: req.user.name || 'Support team', message } } }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  res.json(updated);
});

module.exports = { getTickets, createTicket, replyToTicket };
