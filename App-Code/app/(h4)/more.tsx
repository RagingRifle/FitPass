import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Apple,
  CalendarCheck,
  CreditCard,
  Activity,
  LifeBuoy,
  UserCheck,
} from '@/components/ui/app-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/design-system/theme';

const MORE_LINKS = [
  { title: 'Nutrition', detail: 'Meals and daily targets', route: '/(h4)/diets', Icon: Apple },
  { title: 'Group classes', detail: 'Find your next session', route: '/(h4)/classes', Icon: CalendarCheck },
  { title: 'PT coaching', detail: 'Book time with a trainer', route: '/(h4)/pt-sessions', Icon: UserCheck },
  { title: 'Payments', detail: 'Plans and payment history', route: '/(h4)/payments', Icon: CreditCard },
  { title: 'Body progress', detail: 'Assessments and results', route: '/(h4)/assessments', Icon: Activity },
  { title: 'Help & support', detail: 'Get help from H4', route: '/(h4)/support', Icon: LifeBuoy },
];

export default function H4MoreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>H4 FITNESS</Text>
        <Text style={styles.title}>More for your routine</Text>
        <Text style={styles.subtitle}>Your coaching, care and membership tools in one place.</Text>

        <View style={styles.grid}>
          {MORE_LINKS.map(({ title, detail, route, Icon }) => (
            <Pressable
              key={title}
              onPress={() => router.push(route as any)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${detail}`}
            >
              <View style={styles.iconTile}>
                <Icon size={21} color={theme.colors.primaryText} strokeWidth={2.2} />
              </View>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardDetail}>{detail}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 112 },
  eyebrow: { color: theme.colors.primaryText, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: theme.colors.text, fontSize: 27, lineHeight: 33, fontWeight: '800', marginTop: 8 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: {
    width: '48.3%',
    minHeight: 148,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brandLight,
    marginBottom: 12,
  },
  cardTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  cardDetail: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
