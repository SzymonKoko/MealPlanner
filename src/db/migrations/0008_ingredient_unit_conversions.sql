CREATE TABLE IF NOT EXISTS ingredient_unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  unit text NOT NULL,
  grams_equivalent numeric(12,4) NOT NULL,
  label text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ingredient_unit_conversions_unique_unit_idx
  ON ingredient_unit_conversions (ingredient_id, unit);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredient_unit_conversions_grams_positive_check'
      AND conrelid = 'public.ingredient_unit_conversions'::regclass
  ) THEN
    ALTER TABLE ingredient_unit_conversions
      ADD CONSTRAINT ingredient_unit_conversions_grams_positive_check
      CHECK (grams_equivalent > 0);
  END IF;
END
$$;
