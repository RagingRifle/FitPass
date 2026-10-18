import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Text } from 'react-native';
import { LifeBuoy, Send, PlusCircle, ChevronRight, MessageSquare, Award } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography, Card, Badge, Modal } from '@/components/ui';
import { API_CLIENT } from '@/lib/api-client';
import { H4TopHeader } from './H4TopHeader';
import { fontFamilies } from '@/design-system/tokens';

interface TicketMessage {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  messages: TicketMessage[];
  createdAt: string;
}

export function H4Support() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reply state
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API_CLIENT.get('/tickets');
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        setTickets(data);
        if (activeTicket) {
          const updated = data.find((t: Ticket) => t.id === activeTicket.id);
          if (updated) setActiveTicket(updated);
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch tickets:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [activeTicket]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Required Fields', 'Please fill in both subject and message.');
      return;
    }

    try {
      setSubmitting(true);
      await API_CLIENT.post('/tickets', {
        subject: subject.trim(),
        category,
        message: message.trim(),
      });
      Alert.alert('Ticket Created', 'Your support ticket has been submitted successfully.');
      setSubject('');
      setMessage('');
      setCreateModalOpen(false);
      await fetchTickets();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not create ticket';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeTicket || !replyMessage.trim()) return;

    try {
      setReplying(true);
      const res = await API_CLIENT.post(`/tickets/${activeTicket.id}/reply`, {
        message: replyMessage.trim(),
      });
      setReplyMessage('');
      if (res.data?.data) {
        setActiveTicket(res.data.data);
      }
      await fetchTickets();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not send reply';
      Alert.alert('Error', msg);
    } finally {
      setReplying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5ED' }}>
      <H4TopHeader title="Support Desk" />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerGroup}>
          <View style={styles.headerIconWrap}>
            <LifeBuoy size={18} color="#F5B800" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h2" style={styles.headerTitle}>H4 Help Center</Typography>
            <Typography variant="caption" color="secondary" style={styles.headerSub}>
              Raise tickets & resolve questions with your coach or H4 support
            </Typography>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModalOpen(true)} activeOpacity={0.85}>
            <PlusCircle size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.createBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {tickets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <LifeBuoy size={28} color="#F5B800" />
            </View>
            <Typography variant="bodySm" style={styles.emptyTitle}>No Support Tickets</Typography>
            <Typography variant="caption" color="secondary" style={styles.emptyDesc}>
              Need assistance with your membership, billing, or trainer plan? Click "New Ticket" to send a query.
            </Typography>
          </Card>
        ) : (
          <View style={styles.ticketList}>
            {tickets.map((t) => (
              <TouchableOpacity key={t.id} activeOpacity={0.9} onPress={() => setActiveTicket(t)}>
                <View style={styles.ticketCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                      <Text style={styles.ticketCategory}>Category: {t.category}</Text>
                    </View>
                    <Badge label={t.status} variant={t.status === 'resolved' ? 'active' : 'info'} />
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={13} color="#64748B" />
                      <Text style={styles.messageCountText}>
                        {t.messages?.length || 0} Message{(t.messages?.length || 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#F5B800" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* New Ticket Modal */}
        <Modal visible={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Support Ticket">
          <View style={styles.modalForm}>
            <Text style={styles.inputLabel}>SUBJECT</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Question about membership renewal"
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={styles.inputLabel}>CATEGORY</Text>
            <View style={styles.categoryRow}>
              {['General', 'Billing', 'Workout', 'Branch'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>MESSAGE</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your issue or question in detail..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateTicket} disabled={submitting} activeOpacity={0.85}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Ticket</Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Ticket Details & Thread Modal */}
        <Modal visible={!!activeTicket} onClose={() => setActiveTicket(null)} title={activeTicket?.subject || 'Ticket Details'}>
          {activeTicket ? (
            <View style={styles.threadContainer}>
              <View style={styles.threadHeader}>
                <Badge label={activeTicket.status} variant={activeTicket.status === 'resolved' ? 'active' : 'info'} />
                <Text style={styles.threadCategoryText}>Category: {activeTicket.category}</Text>
              </View>

              <ScrollView style={styles.messagesScroll} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
                {activeTicket.messages?.map((msg) => {
                  const isUser = msg.senderRole === 'member';
                  return (
                    <View key={msg.id} style={[styles.msgBubble, isUser ? styles.msgUser : styles.msgSupport]}>
                      <Text style={[styles.msgSender, isUser ? { color: '#B45309' } : { color: '#1E3A8A' }]}>
                        {msg.senderName} ({msg.senderRole})
                      </Text>
                      <Text style={styles.msgText}>{msg.message}</Text>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.replyBox}>
                <TextInput
                  style={styles.replyInput}
                  placeholder="Type your reply..."
                  placeholderTextColor="#94A3B8"
                  value={replyMessage}
                  onChangeText={setReplyMessage}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSendReply} disabled={replying} activeOpacity={0.85}>
                  {replying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Send size={15} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F5ED' },
  content: { padding: 18, paddingBottom: 100, gap: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5ED' },
  
  headerGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 4 
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { 
    color: '#0F172A', 
    fontWeight: '800', 
    fontSize: 20 
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  createBtn: { 
    backgroundColor: '#000000', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  createBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, letterSpacing: 0.3 },

  emptyCard: { 
    padding: 30, 
    alignItems: 'center', 
    gap: 10, 
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  emptyDesc: { textAlign: 'center', fontSize: 12, color: '#64748B', lineHeight: 18 },
  
  ticketList: { gap: 14 },
  ticketCard: { 
    padding: 16, 
    gap: 12, 
    borderRadius: 20,
    backgroundColor: '#FFFFFF', 
    borderColor: '#E2E8F0', 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  ticketSubject: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  ticketCategory: { fontSize: 11, color: '#64748B', marginTop: 1 },
  
  cardDivider: {
    height: 1,
    backgroundColor: '#F5F1E7',
  },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageCountText: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  
  modalForm: { gap: 10 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  input: { 
    backgroundColor: '#F8F5ED', 
    color: '#0F172A', 
    paddingHorizontal: 12, 
    height: 46,
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    fontSize: 13,
    fontFamily: fontFamilies.body,
  },
  textArea: { height: 90, textAlignVertical: 'top', paddingVertical: 12 },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catChip: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  catChipActive: { backgroundColor: '#F5B800', borderColor: '#F5B800' },
  catChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  catChipTextActive: { color: '#FFFFFF' },
  
  submitBtn: { 
    backgroundColor: '#000000', 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 6 
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  
  threadContainer: { gap: 12, maxHeight: 400 },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadCategoryText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  messagesScroll: { maxHeight: 260 },
  msgBubble: { padding: 12, borderRadius: 12, gap: 4, marginVertical: 3 },
  msgUser: { backgroundColor: 'rgba(240, 160, 32, 0.08)', alignSelf: 'flex-end', width: '85%', borderWidth: 1, borderColor: 'rgba(240, 160, 32, 0.15)' },
  msgSupport: { backgroundColor: '#F8F5ED', alignSelf: 'flex-start', width: '85%', borderWidth: 1, borderColor: '#E2E8F0' },
  msgSender: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  msgText: { color: '#1E293B', fontSize: 13, lineHeight: 18 },
  replyBox: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 6 },
  replyInput: { 
    flex: 1, 
    backgroundColor: '#F8F5ED', 
    color: '#0F172A', 
    paddingHorizontal: 12, 
    height: 42,
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    fontSize: 13 
  },
  sendBtn: { 
    backgroundColor: '#000000', 
    width: 42, 
    height: 42, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});
