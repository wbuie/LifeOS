import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type CaptureMode = 'text' | 'quick-person' | 'quick-prayer' | 'quick-task';

type ClassificationResult = {
  type: string;
  domain: string;
  destination: string;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
  links: string[];
  reasoning: string;
};

const MODES: { key: CaptureMode; label: string; placeholder: string }[] = [
  { key: 'text', label: 'General', placeholder: 'Capture anything…' },
  { key: 'quick-task', label: 'Task', placeholder: 'What needs to be done?' },
  { key: 'quick-person', label: 'Person', placeholder: 'Met / talked to…' },
  { key: 'quick-prayer', label: 'Prayer', placeholder: 'Prayer request…' },
];

export default function CaptureScreen() {
  const [mode, setMode] = useState<CaptureMode>('text');
  const [text, setText] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [filing, setFiling] = useState(false);

  async function handleClassify() {
    if (!text.trim()) return;
    setClassifying(true);
    setResult(null);

    try {
      // TODO: Replace with Supabase Edge Function call once the function is deployed.
      // For now, returns a mock classification so the UI flow is testable.
      await new Promise(r => setTimeout(r, 800));
      setResult({
        type: mode === 'quick-prayer' ? 'prayer'
          : mode === 'quick-person' ? 'person'
          : mode === 'quick-task' ? 'task'
          : 'note',
        domain: 'personal',
        destination: mode === 'quick-prayer' ? 'Cards/Prayers/'
          : mode === 'quick-task' ? 'Atlas/Weekly Planning.md'
          : 'Inbox/',
        title: text.split(' ').slice(0, 5).join(' '),
        frontmatter: { type: mode, status: 'active' },
        body: text,
        links: [],
        reasoning: '(mock — Edge Function not yet deployed)',
      });
    } finally {
      setClassifying(false);
    }
  }

  async function handleFile() {
    if (!result) return;
    setFiling(true);

    try {
      const filePath = result.destination.endsWith('/')
        ? `${result.destination}${result.title.replace(/[^a-zA-Z0-9 -]/g, '')}.md`
        : result.destination;

      const { error: queueError } = await supabase.from('write_queue').insert({
        operation: 'create',
        file_path: filePath,
        content: result.body,
        frontmatter: result.frontmatter,
      });

      if (queueError) throw queueError;

      await supabase.from('captures').insert({
        raw_text: text,
        capture_mode: mode,
        classified_as: result,
        filed_to: filePath,
      });

      setText('');
      setResult(null);
      Alert.alert('Filed!', `Queued for vault: ${filePath}`);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setFiling(false);
    }
  }

  const selectedMode = MODES.find(m => m.key === mode)!;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Capture</Text>

        {/* Mode selector */}
        <View style={styles.modeRow}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
              onPress={() => { setMode(m.key); setResult(null); }}
            >
              <Text style={[styles.modeBtnText, mode === m.key && styles.modeBtnTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input */}
        <TextInput
          style={styles.input}
          multiline
          value={text}
          onChangeText={setText}
          placeholder={selectedMode.placeholder}
          placeholderTextColor="#475569"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.btn, (!text.trim() || classifying) && styles.btnDisabled]}
          onPress={handleClassify}
          disabled={!text.trim() || classifying}
        >
          {classifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Classify with Claude</Text>
          )}
        </TouchableOpacity>

        {/* Classification preview */}
        {result && (
          <View style={styles.preview}>
            <Text style={styles.previewHeading}>Claude thinks this is a…</Text>

            <PreviewRow label="Type" value={result.type} />
            <PreviewRow label="Domain" value={result.domain} />
            <PreviewRow label="Destination" value={result.destination} />
            <PreviewRow label="Title" value={result.title} />
            {result.links.length > 0 && (
              <PreviewRow label="Links" value={result.links.join(', ')} />
            )}
            {result.reasoning && (
              <Text style={styles.reasoning}>{result.reasoning}</Text>
            )}

            <TouchableOpacity
              style={[styles.btn, styles.btnGreen, filing && styles.btnDisabled]}
              onPress={handleFile}
              disabled={filing}
            >
              {filing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>File to Vault</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setResult(null)}>
              <Text style={styles.cancelText}>Edit / Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 40 },
  heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  modeBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#334155',
  },
  modeBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  modeBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  modeBtnTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#1e293b', color: '#e2e8f0',
    borderRadius: 12, padding: 14, minHeight: 100,
    fontSize: 15, textAlignVertical: 'top', marginBottom: 12,
  },
  btn: {
    backgroundColor: '#6366f1', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 8,
  },
  btnGreen: { backgroundColor: '#16a34a' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  preview: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginTop: 8, gap: 8,
  },
  previewHeading: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel: { color: '#64748b', fontSize: 13 },
  previewValue: { color: '#e2e8f0', fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  reasoning: { color: '#475569', fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#64748b', fontSize: 14 },
});
