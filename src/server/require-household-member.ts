import { db } from "@/db/client";
import { householdMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { canEdit, hasMinimumRole, type HouseholdRole } from "@/modules/households/services/role-checks";
import { requireAuth, type AuthUser } from "./require-auth";

export interface HouseholdContext {
  user: AuthUser;
  householdId: string;
  role: HouseholdRole;
}

export async function requireHouseholdMember(
  householdId: string,
  minRole: HouseholdRole = "viewer",
): Promise<HouseholdContext> {
  const user = await requireAuth();

  const [membership] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, user.id)))
    .limit(1);

  if (!membership) {
    throw new ForbiddenError("Nie jesteś członkiem tego gospodarstwa");
  }

  if (!hasMinimumRole(membership.role, minRole)) {
    throw new ForbiddenError("Niewystarczające uprawnienia");
  }

  return { user, householdId, role: membership.role };
}

export async function requireHouseholdEditor(householdId: string): Promise<HouseholdContext> {
  const context = await requireHouseholdMember(householdId, "member");
  if (!canEdit(context.role)) {
    throw new ForbiddenError("Brak uprawnień do edycji");
  }
  return context;
}

export async function getActiveHouseholdId(userId: string): Promise<string | null> {
  const user = await requireAuth();
  if (user.id !== userId) {
    throw new ForbiddenError();
  }
  return user.activeHouseholdId;
}

export async function requireActiveHousehold(): Promise<HouseholdContext> {
  const user = await requireAuth();

  if (!user.activeHouseholdId) {
    throw new NotFoundError("Nie wybrano aktywnego gospodarstwa");
  }

  return requireHouseholdMember(user.activeHouseholdId);
}
