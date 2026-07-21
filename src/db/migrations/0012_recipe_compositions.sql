ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard';

ALTER TABLE recipes
  ADD CONSTRAINT recipes_kind_check
  CHECK (kind IN ('standard', 'composition', 'composition_instance'));

CREATE TABLE IF NOT EXISTS composition_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS composition_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES composition_sections(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  quantity text NOT NULL,
  unit text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT composition_options_exactly_one_source_check
    CHECK (((ingredient_id IS NOT NULL)::int + (product_id IS NOT NULL)::int) = 1)
);

CREATE INDEX IF NOT EXISTS composition_sections_recipe_idx
  ON composition_sections(recipe_id);
CREATE INDEX IF NOT EXISTS composition_options_section_idx
  ON composition_options(section_id);
