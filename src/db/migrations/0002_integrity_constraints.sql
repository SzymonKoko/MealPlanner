UPDATE users AS u
SET active_household_id = NULL, updated_at = now()
WHERE active_household_id IS NOT NULL
  AND (
    NOT EXISTS (
      SELECT 1 FROM households AS h WHERE h.id = u.active_household_id
    )
    OR NOT EXISTS (
      SELECT 1
      FROM household_members AS hm
      WHERE hm.household_id = u.active_household_id
        AND hm.user_id = u.id
    )
  );

UPDATE household_invites
SET role = 'member'
WHERE role = 'owner';

LOCK TABLE shopping_lists IN SHARE ROW EXCLUSIVE MODE;

WITH ranked_active_lists AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY household_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS position
  FROM shopping_lists
  WHERE status = 'active'
)
UPDATE shopping_lists
SET status = 'archived', updated_at = now()
WHERE id IN (
  SELECT id FROM ranked_active_lists WHERE position > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_active_household_id_fk'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_active_household_id_fk
      FOREIGN KEY (active_household_id)
      REFERENCES households(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_members_role_check'
      AND conrelid = 'public.household_members'::regclass
  ) THEN
    ALTER TABLE household_members
      ADD CONSTRAINT household_members_role_check
      CHECK (role IN ('owner', 'member', 'viewer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_invites_role_check'
      AND conrelid = 'public.household_invites'::regclass
  ) THEN
    ALTER TABLE household_invites
      ADD CONSTRAINT household_invites_role_check
      CHECK (role IN ('member', 'viewer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_plan_entries_meal_type_check'
      AND conrelid = 'public.meal_plan_entries'::regclass
  ) THEN
    ALTER TABLE meal_plan_entries
      ADD CONSTRAINT meal_plan_entries_meal_type_check
      CHECK (meal_type IN ('breakfast', 'secondBreakfast', 'lunch', 'dinner', 'snack'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_plan_entries_status_check'
      AND conrelid = 'public.meal_plan_entries'::regclass
  ) THEN
    ALTER TABLE meal_plan_entries
      ADD CONSTRAINT meal_plan_entries_status_check
      CHECK (status IN ('planned', 'prepared', 'eaten'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS shopping_lists_one_active_per_household_idx
  ON shopping_lists (household_id)
  WHERE status = 'active';
