import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, Note, Prayer } from '@/lib/supabase';

export default function HomeScreen() {
  const [efforts, setEfforts] = useState<Note[]>([]);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [people, setPeople] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    const today = new Date().toISOString().split('T')[0];

    const [effortsRes, prayersRes, peopleRes] = await Promise.all([
      supabase
        .from('notes')
        .select('*')
        .eq('type', 'effort')
        .eq('status', 'active')
        .eq('deleted', false)
        .order('deadline', { ascending: true })
        .limit(10),

      supabase
        .from('prayers')
        .select('*, notes(*)')
        .eq('status', 'active')
        .order('last_prayed_at', { ascending: true, nullsFirst: true })
        .limit(5),

      supabase
        .from('notes')
        .select('*')
        .eq('type', 'person')
        .eq('deleted', false)
        .lt('last_contact', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('last_contact', { ascending: true })
        .limit(5),
    ]);

    setEfforts(effortsRes.data ?? []);
    setPrayers(prayersRes.data ?? []);
    setPeople(peopleRes.data ?? []);
    setLoading(false);
  }

  const todayLabel = () => {
    const d = new Date();
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const startOfQ = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    const dayOfQ = Math.ceil((d.getTime() - startOfQ.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Day ${dayOfQ} of Q${q}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.dateLabel}>{todayLabel()}</Text>

        <Section title="Active Efforts">
          {efforts.length === 0 ? (
            <EmptyState text="No active efforts" />
          ) : (
            efforts.map(e => <EffortRow key={e.id} note={e} />)
          )}
        </Section>

        <Section title="Prayer Rotation">
          {prayers.length === 0 ? (
            <EmptyState text="No active prayers" />
          ) : (
            prayers.map(p => <PrayerRow key={p.id} prayer={p} />)
          )}
        </Section>

        <Section title="Reach Out">
          {people.length === 0 ? (
            <EmptyState text="Everyone's been contacted recently" />
          ) : (
            people.map(p => <PersonRow key={p.id} note={p} />)
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function EffortRow({ note }: { note: Note }) {
  const daysUntil = note.deadline
    ? Math.ceil((new Date(note.deadline).getTime() - Date.now()) / 86400000)
    : null;

  const urgency =
    daysUntil === null ? '#94a3b8'
    : daysUntil <= 7 ? '#ef4444'
    : daysUntil <= 14 ? '#f59e0b'
    : '#22c55e';

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: urgency }]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{note.title ?? note.file_name}</Text>
        {note.deadline && (
          <Text style={styles.rowMeta}>
            Due {new Date(note.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {daysUntil !== null && ` · ${daysUntil}d`}
          </Text>
        )}
      </View>
      {note.domain && <DomainBadge domain={note.domain} />}
    </View>
  );
}

function PrayerRow({ prayer }: { prayer: Prayer }) {
  const note = prayer.notes;
  const lastPrayed = prayer.last_prayed_at
    ? `Last prayed ${new Date(prayer.last_prayed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Never prayed';

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: '#a78bfa' }]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{note?.title ?? 'Prayer'}</Text>
        <Text style={styles.rowMeta}>{lastPrayed}</Text>
      </View>
    </View>
  );
}

function PersonRow({ note }: { note: Note }) {
  const daysSince = note.last_contact
    ? Math.floor((Date.now() - new Date(note.last_contact).getTime()) / 86400000)
    : null;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{note.title ?? note.file_name}</Text>
        <Text style={styles.rowMeta}>
          {daysSince !== null ? `${daysSince} days ago` : 'No contact logged'}
        </Text>
      </View>
    </View>
  );
}

function DomainBadge({ domain }: { domain: string }) {
  const colors: Record<string, string> = {
    work: '#3b82f6',
    faith: '#a78bfa',
    personal: '#22c55e',
  };
  return (
    <View style={[styles.badge, { backgroundColor: colors[domain] ?? '#94a3b8' }]}>
      <Text style={styles.badgeText}>{domain}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  dateLabel: { color: '#94a3b8', fontSize: 13, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  emptyText: { color: '#475569', fontSize: 13, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  rowContent: { flex: 1 },
  rowTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '500' },
  rowMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
