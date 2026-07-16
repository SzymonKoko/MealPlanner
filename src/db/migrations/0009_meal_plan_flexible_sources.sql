ALTER TABLE meal_plan_entries
  ALTER COLUMN recipe_id DROP NOT NULL;

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE;

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_plan_entries_source_check'
      AND conrelid = 'public.meal_plan_entries'::regclass
  ) THEN
    ALTER TABLE meal_plan_entries
      ADD CONSTRAINT meal_plan_entries_source_check
      CHECK (
        ((recipe_id IS NOT NULL)::int
          + (ingredient_id IS NOT NULL)::int
          + (product_id IS NOT NULL)::int) = 1
      );
  END IF;
END
$$;
