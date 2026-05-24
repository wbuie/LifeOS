import { SupabaseClient } from '@supabase/supabase-js';
import { ParsedNote } from './parser';
import fs from 'fs';

export async function upsertNote(
  supabase: SupabaseClient,
  note: ParsedNote,
  filePath: string
): Promise<void> {
  const mtime = fs.statSync(filePath).mtime.toISOString();

  const { error } = await supabase.from('notes').upsert(
    {
      file_path: note.filePath,
      file_name: note.fileName,
      type: note.type,
      domain: note.domain,
      status: note.status,
      title: note.title,
      body: note.body,
      frontmatter: note.frontmatter,
      deadline: note.deadline,
      created_date: note.createdDate,
      last_contact: note.lastContact,
      tags: note.tags,
      wikilinks: note.wikilinks,
      file_mtime: mtime,
      synced_at: new Date().toISOString(),
      deleted: false,
    },
    { onConflict: 'file_path' }
  );

  if (error) throw new Error(`upsertNote(${note.filePath}): ${error.message}`);

  // Sync prayers row if this is a prayer note
  if (note.type === 'prayer') {
    await upsertPrayer(supabase, note);
  }
}

async function upsertPrayer(supabase: SupabaseClient, note: ParsedNote): Promise<void> {
  const { data: row } = await supabase
    .from('notes')
    .select('id')
    .eq('file_path', note.filePath)
    .single();

  if (!row) return;

  const fm = note.frontmatter;
  await supabase.from('prayers').upsert(
    {
      note_id: row.id,
      person_link: (fm['person'] as string) ?? null,
      category: (fm['category'] as string) ?? null,
      status: (fm['status'] as string) ?? 'active',
      date_started: (fm['date-started'] as string) ?? null,
      date_answered: (fm['date-answered'] as string) ?? null,
      last_prayed_at: (fm['last-prayed'] as string) ?? null,
    },
    { onConflict: 'note_id' }
  );
}

export async function softDeleteNote(
  supabase: SupabaseClient,
  filePath: string,
  vaultRoot: string
): Promise<void> {
  const relativePath = filePath.replace(vaultRoot + '/', '');
  const { error } = await supabase
    .from('notes')
    .update({ deleted: true, synced_at: new Date().toISOString() })
    .eq('file_path', relativePath);

  if (error) throw new Error(`softDeleteNote(${relativePath}): ${error.message}`);
}

export async function pollWriteQueue(
  supabase: SupabaseClient,
  onWrite: (filePath: string, content: string) => Promise<void>,
  onDelete: (filePath: string) => Promise<void>
): Promise<void> {
  const { data: items, error } = await supabase
    .from('write_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);

  if (error || !items?.length) return;

  for (const item of items) {
    await supabase
      .from('write_queue')
      .update({ status: 'processing' })
      .eq('id', item.id);

    try {
      if (item.operation === 'delete') {
        await onDelete(item.file_path);
      } else {
        const content = buildMarkdown(item.content ?? '', item.frontmatter);
        await onWrite(item.file_path, content);
      }
      await supabase
        .from('write_queue')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', item.id);
    } catch (err) {
      await supabase
        .from('write_queue')
        .update({ status: 'failed', error: String(err) })
        .eq('id', item.id);
    }
  }
}

function buildMarkdown(body: string, frontmatter: Record<string, unknown> | null): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return body;
  const lines = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    lines.push(`${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`);
  }
  lines.push('---', '', body);
  return lines.join('\n');
}
