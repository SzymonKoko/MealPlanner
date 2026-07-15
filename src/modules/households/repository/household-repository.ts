import { db } from "@/db/client";
import { households, householdMembers, householdInvites, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { HouseholdRole } from "@/db/schema/households";

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
  role: HouseholdRole,
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

export async function acceptInviteRecord(inviteId: string, householdId: string, userId: string, role: HouseholdRole) {
  return db.transaction(async (tx) => {
    await tx.insert(householdMembers).values({ householdId, userId, role });
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
