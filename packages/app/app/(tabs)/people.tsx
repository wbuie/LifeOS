import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, Note } from '@/lib/supabase';

export default function PeopleScreen() {
  const [people, setPeople] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeople();
  }, []);

  async function fetchPeople() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('type', 'person')
      .eq('deleted', false)
      .order('last_contact', { ascending: true, nullsFirst: true });

    setPeople(data ?? []);
    setLoading(false);
  }

  const filtered = query.trim()
    ? people.filter(p =>
        (p.title ?? p.file_name).toLowerCase().includes(query.toLowerCase())
      )
    : people;

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
        <Text style={styles.heading}>People</Text>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor="#475569"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No people found</Text>
        ) : (
          filtered.map(p => <PersonRow key={p.id} note={p} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PersonRow({ note }: { note: Note }) {
  const daysSince = note.last_contact
    ? Math.floor((Date.now() - new Date(note.last_contact).getTime()) / 86400000)
    : null;

  const dotColor =
    daysSince === null ? '#475569'
    : daysSince > 60 ? '#ef4444'
    : daysSince > 30 ? '#f59e0b'
    : '#22c55e';

  const lastContactLabel =
    daysSince === null ? 'No contact logged'
    : daysSince === 0 ? 'Today'
    : daysSince === 1 ? 'Yesterday'
    : `${daysSince} days ago`;

  const relationship = note.frontmatter?.['relationship'] as string | undefined;

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: dotColor + '33' }]}>
        <Text style={[styles.avatarText, { color: dotColor }]}>
          {(note.title ?? note.file_name).charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.name}>{note.title ?? note.file_name}</Text>
        <Text style={styles.meta}>
          {relationship ? `${relationship} · ` : ''}{lastContactLabel}
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: { padding: 16, paddingBottom: 8 },
  heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '700', marginBottom: 10 },
  search: {
    backgroundColor: '#1e293b', color: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14,
  },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 40, gap: 4 },
  empty: { color: '#475569', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  rowContent: { flex: 1 },
  name: { color: '#e2e8f0', fontSize: 15, fontWeight: '500' },
  meta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
