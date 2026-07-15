import { householdRoleEnum, type HouseholdRole } from "@/db/schema/households";

const ROLE_RANK: Record<HouseholdRole, number> = {
  viewer: 1,
  member: 2,
  owner: 3,
};

export function hasMinimumRole(userRole: HouseholdRole, requiredRole: HouseholdRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export function canEdit(role: HouseholdRole): boolean {
  return hasMinimumRole(role, "member");
}

export function canManageMembers(role: HouseholdRole): boolean {
  return role === "owner";
}

export { householdRoleEnum, type HouseholdRole };
