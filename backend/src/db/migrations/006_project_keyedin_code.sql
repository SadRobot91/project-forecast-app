-- Add Keyedin project code to Project table for API sync mapping
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS keyedin_code VARCHAR(100);
