-- Life OS Initial Schema
-- Apply to a fresh Supabase project.
-- Requires: pgvector extension (available on all Supabase projects)

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Notes ───────────────────────────────────────────────────────────────────
-- Core table. Mirrors the vault. One row per .md file.

CREATE TABLE notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path       TEXT        UNIQUE NOT NULL,   -- relative path from vault root
  file_name       TEXT        NOT NULL,           -- filename without extension
  type            TEXT,                           -- effort | person | prayer | book | meeting | daily | inbox
  domain          TEXT,                           -- work | faith | personal
  status          TEXT,                           -- active | completed | blocked | archived
  title           TEXT,
  body            TEXT,                           -- full markdown body
  frontmatter     JSONB,                          -- all frontmatter fields
  deadline        DATE,
  created_date    DATE,
  last_contact    DATE,                           -- people cards
  tags            TEXT[],
  wikilinks       TEXT[],                         -- outbound [[links]]
  file_mtime      TIMESTAMPTZ,                    -- filesystem modified time
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted         BOOLEAN     DEFAULT FALSE
);

CREATE INDEX notes_type_idx         ON notes(type);
CREATE INDEX notes_domain_idx       ON notes(domain);
CREATE INDEX notes_status_idx       ON notes(status);
CREATE INDEX notes_deadline_idx     ON notes(deadline);
CREATE INDEX notes_last_contact_idx ON notes(last_contact);
CREATE INDEX notes_deleted_idx      ON notes(deleted);
CREATE INDEX notes_tags_idx         ON notes USING GIN(tags);
CREATE INDEX notes_wikilinks_idx    ON notes USING GIN(wikilinks);
CREATE INDEX notes_frontmatter_idx  ON notes USING GIN(frontmatter);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_authenticated" ON notes
  USING (auth.role() = 'authenticated');

-- ─── Note Chunks ─────────────────────────────────────────────────────────────
-- 512-token chunks with embeddings for semantic search (pgvector).

CREATE TABLE note_chunks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id      UUID        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  chunk_index  INTEGER     NOT NULL,
  content      TEXT        NOT NULL,
  embedding    VECTOR(1536),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX note_chunks_note_id_idx   ON note_chunks(note_id);
-- IVFFlat index; rebuild with higher lists count once > 100k chunks
CREATE INDEX note_chunks_embedding_idx ON note_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE note_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "note_chunks_authenticated" ON note_chunks
  USING (auth.role() = 'authenticated');

-- ─── Write Queue ─────────────────────────────────────────────────────────────
-- Changes originating from the app that the Mac sync service writes to disk.

CREATE TABLE write_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  operation    TEXT        NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  file_path    TEXT        NOT NULL,
  content      TEXT,
  frontmatter  JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status       TEXT        DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error        TEXT
);

CREATE INDEX write_queue_status_idx     ON write_queue(status);
CREATE INDEX write_queue_created_at_idx ON write_queue(created_at);

ALTER TABLE write_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "write_queue_authenticated" ON write_queue
  USING (auth.role() = 'authenticated');

-- ─── Prayers ─────────────────────────────────────────────────────────────────
-- Denormalized for fast queries (avoids scanning frontmatter JSONB every time).

CREATE TABLE prayers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        UUID        REFERENCES notes(id) ON DELETE CASCADE,
  person_link    TEXT,
  category       TEXT,
  status         TEXT        DEFAULT 'active' CHECK (status IN ('active', 'answered', 'archived')),
  date_started   DATE,
  date_answered  DATE,
  last_prayed_at DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX prayers_status_idx        ON prayers(status);
CREATE INDEX prayers_last_prayed_at_idx ON prayers(last_prayed_at);
CREATE INDEX prayers_person_link_idx   ON prayers(person_link);

ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prayers_authenticated" ON prayers
  USING (auth.role() = 'authenticated');

-- ─── Captures ────────────────────────────────────────────────────────────────
-- Log of every capture made from the app.

CREATE TABLE captures (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text      TEXT        NOT NULL,
  capture_mode  TEXT        CHECK (capture_mode IN ('voice', 'text', 'quick-person', 'quick-prayer', 'quick-task')),
  classified_as JSONB,      -- Claude's full classification response
  filed_to      TEXT,       -- resulting file_path
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX captures_created_at_idx  ON captures(created_at);
CREATE INDEX captures_mode_idx        ON captures(capture_mode);

ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "captures_authenticated" ON captures
  USING (auth.role() = 'authenticated');

-- ─── Semantic Search Function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_note_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT  DEFAULT 0.7,
  match_count     INT    DEFAULT 10
)
RETURNS TABLE (
  note_id       UUID,
  file_path     TEXT,
  title         TEXT,
  chunk_content TEXT,
  similarity    FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.id          AS note_id,
    n.file_path,
    n.title,
    nc.content    AS chunk_content,
    1 - (nc.embedding <=> query_embedding) AS similarity
  FROM note_chunks nc
  JOIN notes n ON n.id = nc.note_id
  WHERE 1 - (nc.embedding <=> query_embedding) > match_threshold
    AND n.deleted = FALSE
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
$$;
