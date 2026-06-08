BEGIN;
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE;
COMMENT ON COLUMN "User".supabase_uid IS
  'Supabase Auth UUID — maps the Supabase identity to the internal User row.';
COMMIT;
