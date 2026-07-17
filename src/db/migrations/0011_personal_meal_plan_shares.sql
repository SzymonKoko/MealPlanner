ALTER TABLE "meal_plan_assignments"
  ADD COLUMN "share" numeric(9, 8);

UPDATE "meal_plan_assignments" AS mpa
SET "share" = mpa."servings"::numeric / NULLIF(mpe."servings", 0)
FROM "meal_plan_entries" AS mpe
WHERE mpe."id" = mpa."meal_plan_entry_id";

DELETE FROM "meal_plan_assignments"
WHERE "share" IS NULL OR "share" <= 0;

ALTER TABLE "meal_plan_assignments"
  ALTER COLUMN "share" SET NOT NULL,
  ADD CONSTRAINT "meal_plan_assignments_share_check"
    CHECK ("share" > 0 AND "share" <= 1);

ALTER TABLE "meal_plan_assignments"
  DROP COLUMN "servings";
