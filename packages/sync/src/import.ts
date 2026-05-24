/**
 * One-shot full vault import.
 * Run once against a fresh Supabase project to populate the notes table.
 * Usage: ts-node src/import.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parseNote } from './parser';
import { upsertNote } from './sync';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAULT_PATH = process.env.VAULT_PATH!;

if (!SUPABASE_URL || !SUPABASE_KEY || !VAULT_PATH) {
  console.error('Missing env vars. Copy .env.example → .env and fill in values.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function walkVault(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '.obsidian') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkVault(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const files = walkVault(VAULT_PATH);
  console.log(`Found ${files.length} markdown files. Importing…`);

  let success = 0;
  let failed = 0;

  // Process in batches of 20 to avoid overwhelming Supabase
  for (let i = 0; i < files.length; i += 20) {
    const batch = files.slice(i, i + 20);
    await Promise.all(
      batch.map(async filePath => {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const note = parseNote(filePath, VAULT_PATH, raw);
          await upsertNote(supabase, note, filePath);
          success++;
        } catch (err) {
          console.error(`  ✗ ${filePath}:`, err);
          failed++;
        }
      })
    );
    console.log(`  ${Math.min(i + 20, files.length)} / ${files.length}`);
  }

  console.log(`\nDone. ✓ ${success} imported, ✗ ${failed} failed.`);
}

main().catch(console.error);
