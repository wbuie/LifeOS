import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, Note } from '@/lib/supabase';

type Domain = 'all' | 'work' | 'faith' | 'personal';

export default function EffortsScreen() {
  const [efforts, setEfforts] = useState<Note[]>([]);
  const [filter, setFilter] = useState<Domain>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEfforts();
  }, []);

  async function fetchEfforts() {
    const query = supabase
      .from('notes')
      .select('*')
      .eq('type', 'effort')
      .eq('deleted', false)
      .in('status', ['active', 'blocked'])
      .order('deadline', { ascending: true, nullsLast: true });

    const { data } = await query;
    setEfforts(data ?? []);
    setLoading(false);
  }

  const filtered = filter === 'all' ? efforts : efforts.filter(e => e.domain === filter);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Efforts</Text>
        <View style={styles.filterRow}>
          {(['all', 'work', 'faith', 'personal'] as Domain[]).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.filterBtn, filter === d && styles.filterBtnActive]}
              onPress={() => setFilter(d)}
            >
              <Text style={[styles.filterText, filter === d && styles.filterTextActive]}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No active efforts</Text>
        ) : (
          filtered.map(e => <EffortCard key={e.id} note={e} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EffortCard({ note }: { note: Note }) {
  const daysUntil = note.deadline
    ? Math.ceil((new Date(note.deadline).getTime() - Date.now()) / 86400000)
    : null;

  const deadlineColor =
    daysUntil === null ? '#64748b'
    : daysUntil < 0 ? '#ef4444'
    : daysUntil <= 7 ? '#ef4444'
    : daysUntil <= 14 ? '#f59e0b'
    : '#22c55e';

  const nextAction = note.frontmatter?.['next-action'] as string | undefined;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {note.title ?? note.file_name}
        </Text>
        <View style={styles.badges}>
          {note.domain && <DomainBadge domain={note.domain} />}
          {note.status === 'blocked' && (
            <View style={[styles.badge, { backgroundColor: '#7f1d1d' }]}>
              <Text style={styles.badgeText}>blocked</Text>
            </View>
          )}
        </View>
      </View>

      {nextAction && (
        <Text style={styles.nextAction} numberOfLines={1}>→ {nextAction}</Text>
      )}

      {note.deadline && (
        <Text style={[styles.deadline, { color: deadlineColor }]}>
          {new Date(note.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {daysUntil !== null && (
            daysUntil < 0 ? ` · ${Math.abs(daysUntil)}d overdue`
            : ` · ${daysUntil}d`
          )}
        </Text>
      )}
    </View>
  );
}

function DomainBadge({ domain }: { domain: string }) {
  const colors: Record<string, string> = {
    work: '#1d4ed8',
    faith: '#5b21b6',
    personal: '#166534',
  };
  return (
    <View style={[styles.badge, { backgroundColor: colors[domain] ?? '#334155' }]}>
      <Text style={styles.badgeText}>{domain}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: { padding: 16, paddingBottom: 0 },
  heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: '#334155',
  },
  filterBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterText: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 40, gap: 10 },
  empty: { color: '#475569', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 14, gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '600', flex: 1 },
  badges: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  nextAction: { color: '#94a3b8', fontSize: 13 },
  deadline: { fontSize: 12, fontWeight: '500' },
});
