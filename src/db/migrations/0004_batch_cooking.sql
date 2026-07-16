ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS is_batch_cooking boolean NOT NULL DEFAULT false;
