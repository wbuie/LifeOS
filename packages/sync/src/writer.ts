import fs from 'fs';
import path from 'path';

export async function writeNoteFile(vaultRoot: string, relativePath: string, content: string): Promise<void> {
  const absPath = path.join(vaultRoot, relativePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf-8');
}

export async function deleteNoteFile(vaultRoot: string, relativePath: string): Promise<void> {
  const absPath = path.join(vaultRoot, relativePath);
  if (!fs.existsSync(absPath)) return;
  const trashPath = absPath.replace(/\.md$/, `-deleted-${Date.now()}.md`);
  fs.renameSync(absPath, trashPath);
}
