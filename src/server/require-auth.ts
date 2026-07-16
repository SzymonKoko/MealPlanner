import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UnauthorizedError } from "@/lib/errors";

export interface AuthUser {
  id: string;
  authProviderId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  activeHouseholdId: string | null;
}

export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }

  const authProviderId = session.user.id ?? session.user.email;

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.authProviderId, authProviderId))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        authProviderId,
        email: session.user.email,
        displayName: session.user.name ?? session.user.email,
        avatarUrl: session.user.image ?? null,
      })
      .returning();
  } else {
    const displayName = session.user.name ?? session.user.email;
    const avatarUrl = session.user.image ?? null;
    if (
      user.email !== session.user.email ||
      user.displayName !== displayName ||
      user.avatarUrl !== avatarUrl
    ) {
      [user] = await db
        .update(users)
        .set({
          email: session.user.email,
          displayName,
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
    }
  }

  return {
    id: user.id,
    authProviderId: user.authProviderId,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    activeHouseholdId: user.activeHouseholdId,
  };
}
