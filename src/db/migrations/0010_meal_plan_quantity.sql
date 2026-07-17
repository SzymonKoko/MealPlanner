ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS quantity numeric(12, 4),
  ADD COLUMN IF NOT EXISTS unit text;

UPDATE meal_plan_entries mpe
SET quantity = mpe.servings * 100,
    unit = COALESCE(i.base_unit, 'g')
FROM ingredients i
WHERE mpe.ingredient_id = i.id
  AND mpe.quantity IS NULL;

UPDATE meal_plan_entries mpe
SET quantity = mpe.servings * COALESCE(p.package_quantity::numeric, 100),
    unit = COALESCE(
      p.package_unit,
      CASE WHEN p.nutrition_basis = 'per100ml' THEN 'ml' ELSE 'g' END
    )
FROM products p
WHERE mpe.product_id = p.id
  AND mpe.quantity IS NULL;
