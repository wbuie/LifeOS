import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { startWatcher } from './watcher';
import { pollWriteQueue } from './sync';
import { writeNoteFile, deleteNoteFile } from './writer';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAULT_PATH = process.env.VAULT_PATH!;

if (!SUPABASE_URL || !SUPABASE_KEY || !VAULT_PATH) {
  console.error('Missing env vars. Copy .env.example → .env and fill in values.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`[life-os-sync] starting`);
  console.log(`[life-os-sync] vault: ${VAULT_PATH}`);
  console.log(`[life-os-sync] supabase: ${SUPABASE_URL}`);

  // Watch vault for changes → push to Supabase
  const watcher = startWatcher(supabase, VAULT_PATH);
  watcher.on('ready', () => console.log('[life-os-sync] vault watcher ready'));

  // Poll write queue every 2 seconds → write .md files from app changes
  setInterval(async () => {
    try {
      await pollWriteQueue(
        supabase,
        (relativePath, content) => writeNoteFile(VAULT_PATH, relativePath, content),
        (relativePath) => deleteNoteFile(VAULT_PATH, relativePath)
      );
    } catch (err) {
      console.error('[write-queue] poll error:', err);
    }
  }, 2000);

  process.on('SIGINT', () => {
    console.log('\n[life-os-sync] shutting down');
    watcher.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('[life-os-sync] fatal:', err);
  process.exit(1);
});
