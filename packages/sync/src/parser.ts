import matter from 'gray-matter';
import path from 'path';

export interface ParsedNote {
  filePath: string;
  fileName: string;
  type: string | null;
  domain: string | null;
  status: string | null;
  title: string | null;
  body: string;
  frontmatter: Record<string, unknown>;
  deadline: string | null;
  createdDate: string | null;
  lastContact: string | null;
  tags: string[];
  wikilinks: string[];
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
const BODY_TAG_RE = /#([a-zA-Z][a-zA-Z0-9_/-]*)/g;

function extractWikilinks(text: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    links.push(m[1].trim());
  }
  return [...new Set(links)];
}

function extractBodyTags(text: string): string[] {
  const tags: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = BODY_TAG_RE.exec(text)) !== null) {
    tags.push(m[1]);
  }
  return tags;
}

function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function normalizeTags(fm: Record<string, unknown>, body: string): string[] {
  const fmTags: string[] = [];
  const raw = fm['tags'];
  if (Array.isArray(raw)) {
    raw.forEach(t => fmTags.push(String(t)));
  } else if (typeof raw === 'string') {
    fmTags.push(...raw.split(',').map(t => t.trim()).filter(Boolean));
  }
  return [...new Set([...fmTags, ...extractBodyTags(body)])];
}

export function parseNote(absolutePath: string, vaultRoot: string, rawContent: string): ParsedNote {
  const { data: fm, content: body } = matter(rawContent);
  const filePath = path.relative(vaultRoot, absolutePath).replace(/\\/g, '/');
  const fileName = path.basename(absolutePath, '.md');

  return {
    filePath,
    fileName,
    type: (fm['type'] as string) ?? null,
    domain: (fm['domain'] as string) ?? null,
    status: (fm['status'] as string) ?? null,
    title: (fm['title'] as string) ?? fileName,
    body,
    frontmatter: fm,
    deadline: toDateString(fm['deadline']),
    createdDate: toDateString(fm['date-created'] ?? fm['created']),
    lastContact: toDateString(fm['date-last-contact'] ?? fm['last-contact']),
    tags: normalizeTags(fm, body),
    wikilinks: extractWikilinks(body),
  };
}
