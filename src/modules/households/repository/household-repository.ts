import { db } from "@/db/client";
import { households, householdMembers, householdInvites, users, mealPlanAssignments, mealPlanEntries } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { HouseholdRole, InviteRole } from "@/db/schema/households";

export async function listUserHouseholds(userId: string) {
  return db
    .select({
      id: households.id,
      name: households.name,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId));
}

export async function getHouseholdMembers(householdId: string) {
  return db
    .select({
      id: householdMembers.id,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      role: householdMembers.role,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId));
}

export async function createHouseholdRecord(name: string, ownerId: string) {
  return db.transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ name, ownerId })
      .returning();

    await tx.insert(householdMembers).values({
      householdId: household.id,
      userId: ownerId,
      role: "owner",
    });

    await tx
      .update(users)
      .set({ activeHouseholdId: household.id, updatedAt: new Date() })
      .where(eq(users.id, ownerId));

    return household;
  });
}

export async function setActiveHousehold(userId: string, householdId: string) {
  await db
    .update(users)
    .set({ activeHouseholdId: householdId, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function createInvite(
  householdId: string,
  invitedBy: string,
  token: string,
  expiresAt: Date,
  role: InviteRole,
  email?: string,
) {
  const [invite] = await db
    .insert(householdInvites)
    .values({ householdId, invitedBy, token, expiresAt, role, email: email || null })
    .returning();
  return invite;
}

export async function getInviteByToken(token: string) {
  const [invite] = await db
    .select()
    .from(householdInvites)
    .where(eq(householdInvites.token, token))
    .limit(1);
  return invite ?? null;
}

export async function getInvitePreview(token: string) {
  const [invite] = await db
    .select({
      householdName: households.name,
      role: householdInvites.role,
      expiresAt: householdInvites.expiresAt,
    })
    .from(householdInvites)
    .innerJoin(households, eq(householdInvites.householdId, households.id))
    .where(eq(householdInvites.token, token))
    .limit(1);
  return invite ?? null;
}

export async function acceptInviteRecord(inviteId: string, householdId: string, userId: string, role: InviteRole) {
  return db.transaction(async (tx) => {
    await tx
      .insert(householdMembers)
      .values({ householdId, userId, role })
      .onConflictDoNothing({
        target: [householdMembers.householdId, householdMembers.userId],
      });
    await tx.delete(householdInvites).where(eq(householdInvites.id, inviteId));
    await tx
      .update(users)
      .set({ activeHouseholdId: householdId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });
}

export async function getHouseholdInvites(householdId: string) {
  return db.select().from(householdInvites).where(eq(householdInvites.householdId, householdId));
}

export async function getMembership(householdId: string, userId: string) {
  const [membership] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .limit(1);
  return membership ?? null;
}

export async function renameHousehold(householdId: string, name: string) {
  const [household] = await db
    .update(households)
    .set({ name, updatedAt: new Date() })
    .where(eq(households.id, householdId))
    .returning();
  return household ?? null;
}

export async function updateMembershipRole(
  householdId: string,
  userId: string,
  role: Exclude<HouseholdRole, "owner">,
) {
  const [membership] = await db
    .update(householdMembers)
    .set({ role })
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
      ),
    )
    .returning();
  return membership ?? null;
}

export async function removeHouseholdMember(householdId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .delete(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId),
        ),
      )
      .returning();
    if (!membership) return null;
    const householdEntries = await tx.select({ id: mealPlanEntries.id })
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.householdId, householdId));
    if (householdEntries.length) {
      await tx.delete(mealPlanAssignments).where(and(
        eq(mealPlanAssignments.userId, userId),
        inArray(mealPlanAssignments.mealPlanEntryId, householdEntries.map(({ id }) => id)),
      ));
    }
    await tx
      .update(users)
      .set({ activeHouseholdId: null, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.activeHouseholdId, householdId)));
    return membership;
  });
}

export async function transferHouseholdOwnership(
  householdId: string,
  currentOwnerId: string,
  newOwnerId: string,
) {
  return db.transaction(async (tx) => {
    await tx
      .update(householdMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentOwnerId),
        ),
      );
    const [newOwner] = await tx
      .update(householdMembers)
      .set({ role: "owner" })
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, newOwnerId),
        ),
      )
      .returning();
    if (!newOwner) throw new Error("New owner is not a household member");
    await tx
      .update(households)
      .set({ ownerId: newOwnerId, updatedAt: new Date() })
      .where(eq(households.id, householdId));
    return newOwner;
  });
}

export async function revokeInvite(householdId: string, inviteId: string) {
  const [invite] = await db
    .delete(householdInvites)
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.householdId, householdId),
      ),
    )
    .returning();
  return invite ?? null;
}
