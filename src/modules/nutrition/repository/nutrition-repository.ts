import { db } from "@/db/client";
import { userNutritionGoals } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getNutritionGoals(userId: string) {
  const [goals] = await db
    .select()
    .from(userNutritionGoals)
    .where(eq(userNutritionGoals.userId, userId))
    .limit(1);
  return goals ?? null;
}

export async function upsertNutritionGoals(
  userId: string,
  data: {
    kcalTarget?: string;
    proteinTarget?: string;
    carbsTarget?: string;
    fatTarget?: string;
    fiberTarget?: string;
  },
) {
  const existing = await getNutritionGoals(userId);
  if (existing) {
    const [updated] = await db
      .update(userNutritionGoals)
      .set(data)
      .where(eq(userNutritionGoals.userId, userId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(userNutritionGoals)
    .values({ userId, ...data })
    .returning();
  return created;
}
