INSERT INTO household_members (household_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM households
ON CONFLICT (household_id, user_id)
DO UPDATE SET role = 'owner';

UPDATE household_members AS member
SET role = 'member'
FROM households AS household
WHERE member.household_id = household.id
  AND member.role = 'owner'
  AND member.user_id <> household.owner_id;

CREATE UNIQUE INDEX IF NOT EXISTS household_members_one_owner_idx
  ON household_members (household_id)
  WHERE role = 'owner';
