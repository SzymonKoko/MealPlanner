ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS density_grams_per_ml text,
  ADD COLUMN IF NOT EXISTS allergens text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredients_density_positive_check'
      AND conrelid = 'public.ingredients'::regclass
  ) THEN
    ALTER TABLE ingredients
      ADD CONSTRAINT ingredients_density_positive_check
      CHECK (
        density_grams_per_ml IS NULL
        OR density_grams_per_ml::numeric > 0
      );
  END IF;
END
$$;
