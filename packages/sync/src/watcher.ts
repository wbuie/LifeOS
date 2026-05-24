import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { parseNote } from './parser';
import { upsertNote, softDeleteNote } from './sync';

// Debounce map: file path → timer. Prevents double-firing on rapid saves.
const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

function debounce(key: string, fn: () => void, ms = 500): void {
  const existing = debounceMap.get(key);
  if (existing) clearTimeout(existing);
  debounceMap.set(key, setTimeout(() => { debounceMap.delete(key); fn(); }, ms));
}

export function startWatcher(supabase: SupabaseClient, vaultRoot: string): chokidar.FSWatcher {
  const watcher = chokidar.watch(vaultRoot, {
    ignored: [
      /(^|[/\\])\../,            // dotfiles
      /\.obsidian\//,             // Obsidian config dir
      /node_modules/,
    ],
    persistent: true,
    ignoreInitial: false,         // process existing files on startup
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher
    .on('add', filePath => handleChange(supabase, vaultRoot, filePath))
    .on('change', filePath => handleChange(supabase, vaultRoot, filePath))
    .on('unlink', filePath => handleDelete(supabase, vaultRoot, filePath))
    .on('error', err => console.error('[watcher] error:', err));

  return watcher;
}

function handleChange(supabase: SupabaseClient, vaultRoot: string, filePath: string): void {
  if (path.extname(filePath) !== '.md') return;

  debounce(filePath, async () => {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const note = parseNote(filePath, vaultRoot, raw);
      await upsertNote(supabase, note, filePath);
      console.log(`[sync] ↑ ${note.filePath}`);
    } catch (err) {
      console.error(`[sync] failed ${filePath}:`, err);
    }
  });
}

function handleDelete(supabase: SupabaseClient, vaultRoot: string, filePath: string): void {
  if (path.extname(filePath) !== '.md') return;
  softDeleteNote(supabase, filePath, vaultRoot)
    .then(() => console.log(`[sync] ✕ ${filePath}`))
    .catch(err => console.error(`[sync] delete failed ${filePath}:`, err));
}
