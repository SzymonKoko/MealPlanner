DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'source'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'data_source'
  ) THEN
    ALTER TABLE products RENAME COLUMN source TO data_source;
  END IF;
END
$$;

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS nutrition_basis text,
  ADD COLUMN IF NOT EXISTS salt_per_100 numeric(12,4),
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_modified boolean NOT NULL DEFAULT false;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS nutrition_basis text,
  ADD COLUMN IF NOT EXISTS salt_per_100 numeric(12,4),
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_modified boolean NOT NULL DEFAULT false;

UPDATE ingredients
SET nutrition_basis = CASE
  WHEN base_unit IN ('ml', 'l') THEN 'per100ml'
  ELSE 'per100g'
END
WHERE nutrition_basis IS NULL;

UPDATE products
SET nutrition_basis = CASE
  WHEN package_unit IN ('ml', 'l') THEN 'per100ml'
  ELSE 'per100g'
END
WHERE nutrition_basis IS NULL;

UPDATE ingredients
SET data_source = 'manual'
WHERE data_source IS NULL
   OR data_source NOT IN (
     'manual',
     'open_food_facts',
     'usda',
     'nutrition_label_ocr',
     'household_override'
   );

UPDATE products
SET data_source = 'manual'
WHERE data_source IS NULL
   OR data_source NOT IN (
     'manual',
     'open_food_facts',
     'usda',
     'nutrition_label_ocr',
     'household_override'
   );

ALTER TABLE ingredients
  ALTER COLUMN nutrition_basis SET DEFAULT 'per100g',
  ALTER COLUMN nutrition_basis SET NOT NULL,
  ALTER COLUMN data_source SET DEFAULT 'manual',
  ALTER COLUMN data_source SET NOT NULL,
  ALTER COLUMN kcal_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(kcal_per_100) ~ '^\d+([.]\d+)?$' THEN kcal_per_100::numeric ELSE NULL END,
  ALTER COLUMN protein_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(protein_per_100) ~ '^\d+([.]\d+)?$' THEN protein_per_100::numeric ELSE NULL END,
  ALTER COLUMN carbs_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(carbs_per_100) ~ '^\d+([.]\d+)?$' THEN carbs_per_100::numeric ELSE NULL END,
  ALTER COLUMN fat_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(fat_per_100) ~ '^\d+([.]\d+)?$' THEN fat_per_100::numeric ELSE NULL END,
  ALTER COLUMN fiber_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(fiber_per_100) ~ '^\d+([.]\d+)?$' THEN fiber_per_100::numeric ELSE NULL END;

ALTER TABLE products
  ALTER COLUMN nutrition_basis SET DEFAULT 'per100g',
  ALTER COLUMN nutrition_basis SET NOT NULL,
  ALTER COLUMN data_source SET DEFAULT 'manual',
  ALTER COLUMN data_source SET NOT NULL,
  ALTER COLUMN kcal_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(kcal_per_100) ~ '^\d+([.]\d+)?$' THEN kcal_per_100::numeric ELSE NULL END,
  ALTER COLUMN protein_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(protein_per_100) ~ '^\d+([.]\d+)?$' THEN protein_per_100::numeric ELSE NULL END,
  ALTER COLUMN carbs_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(carbs_per_100) ~ '^\d+([.]\d+)?$' THEN carbs_per_100::numeric ELSE NULL END,
  ALTER COLUMN fat_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(fat_per_100) ~ '^\d+([.]\d+)?$' THEN fat_per_100::numeric ELSE NULL END,
  ALTER COLUMN fiber_per_100 TYPE numeric(12,4)
    USING CASE WHEN trim(fiber_per_100) ~ '^\d+([.]\d+)?$' THEN fiber_per_100::numeric ELSE NULL END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredients_nutrition_basis_check'
      AND conrelid = 'public.ingredients'::regclass
  ) THEN
    ALTER TABLE ingredients
      ADD CONSTRAINT ingredients_nutrition_basis_check
      CHECK (nutrition_basis IN ('per100g', 'per100ml'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_nutrition_basis_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_nutrition_basis_check
      CHECK (nutrition_basis IN ('per100g', 'per100ml'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredients_data_source_check'
      AND conrelid = 'public.ingredients'::regclass
  ) THEN
    ALTER TABLE ingredients
      ADD CONSTRAINT ingredients_data_source_check
      CHECK (data_source IN (
        'manual',
        'open_food_facts',
        'usda',
        'nutrition_label_ocr',
        'household_override'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_data_source_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_data_source_check
      CHECK (data_source IN (
        'manual',
        'open_food_facts',
        'usda',
        'nutrition_label_ocr',
        'household_override'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredients_nutrition_nonnegative_check'
      AND conrelid = 'public.ingredients'::regclass
  ) THEN
    ALTER TABLE ingredients
      ADD CONSTRAINT ingredients_nutrition_nonnegative_check
      CHECK (
        (kcal_per_100 IS NULL OR kcal_per_100 >= 0)
        AND (protein_per_100 IS NULL OR protein_per_100 >= 0)
        AND (carbs_per_100 IS NULL OR carbs_per_100 >= 0)
        AND (fat_per_100 IS NULL OR fat_per_100 >= 0)
        AND (fiber_per_100 IS NULL OR fiber_per_100 >= 0)
        AND (salt_per_100 IS NULL OR salt_per_100 >= 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_nutrition_nonnegative_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_nutrition_nonnegative_check
      CHECK (
        (kcal_per_100 IS NULL OR kcal_per_100 >= 0)
        AND (protein_per_100 IS NULL OR protein_per_100 >= 0)
        AND (carbs_per_100 IS NULL OR carbs_per_100 >= 0)
        AND (fat_per_100 IS NULL OR fat_per_100 >= 0)
        AND (fiber_per_100 IS NULL OR fiber_per_100 >= 0)
        AND (salt_per_100 IS NULL OR salt_per_100 >= 0)
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ingredients_household_source_external_idx
  ON ingredients (household_id, data_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_household_source_external_idx
  ON products (household_id, data_source, external_id)
  WHERE external_id IS NOT NULL;
