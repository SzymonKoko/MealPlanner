CREATE UNIQUE INDEX IF NOT EXISTS products_household_barcode_idx
  ON products (household_id, barcode)
  WHERE barcode IS NOT NULL;
