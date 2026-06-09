-- Migration 013: pgvector extension + embedding column on Project
-- Enables semantic similarity search on project descriptions.
-- Uses vector(1536) for compatibility with OpenAI text-embedding-ada-002 and similar models.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS description_embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_project_embedding
  ON "Project" USING ivfflat (description_embedding vector_cosine_ops)
  WITH (lists = 10);

COMMIT;
