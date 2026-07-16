import { db } from "@/db/client";
import {
  mealPlanEntries,
  mealPlanAssignments,
  recipes,
  users,
} from "@/db/schema";
import { and, eq, gte, lte, between, inArray, isNull } from "drizzle-orm";
import { addDays, format, parseISO } from "date-fns";
import type { MealType } from "@/db/schema/meal-planner";

export async function getMealPlanForWeek(householdId: string, weekStart: string) {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  const dateFrom = format(start, "yyyy-MM-dd");
  const dateTo = format(end, "yyyy-MM-dd");

  const entries = await db
    .select({
      entry: mealPlanEntries,
      recipeName: recipes.name,
      recipeImageUrl: recipes.imageUrl,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        between(mealPlanEntries.date, dateFrom, dateTo),
        isNull(recipes.deletedAt),
      ),
    )
    .orderBy(mealPlanEntries.date, mealPlanEntries.mealType);

  const entryIds = entries.map((e) => e.entry.id);
  const assignments = entryIds.length
    ? await db
        .select({
          assignment: mealPlanAssignments,
          displayName: users.displayName,
        })
        .from(mealPlanAssignments)
        .innerJoin(users, eq(mealPlanAssignments.userId, users.id))
        .where(inArray(mealPlanAssignments.mealPlanEntryId, entryIds))
    : [];

  return { entries, assignments, dateFrom, dateTo };
}

export async function getMealPlanForDate(householdId: string, date: string) {
  return db
    .select({
      entry: mealPlanEntries,
      recipeName: recipes.name,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        eq(mealPlanEntries.date, date),
        isNull(recipes.deletedAt),
      ),
    )
    .orderBy(mealPlanEntries.mealType);
}

export async function createMealPlanEntry(
  householdId: string,
  userId: string,
  data: {
    recipeId: string;
    date: string;
    mealType: MealType;
    servings: number;
    notes?: string;
  },
) {
  const [entry] = await db
    .insert(mealPlanEntries)
    .values({
      householdId,
      createdBy: userId,
      ...data,
    })
    .returning();
  return entry;
}

export async function updateMealPlanEntry(
  householdId: string,
  entryId: string,
  data: Partial<{
    date: string;
    mealType: MealType;
    servings: number;
    notes: string;
    recipeId: string;
    status: string;
    isBatchCooking: boolean;
  }>,
) {
  const [entry] = await db
    .update(mealPlanEntries)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(mealPlanEntries.id, entryId), eq(mealPlanEntries.householdId, householdId)))
    .returning();
  return entry;
}

export async function deleteMealPlanEntry(householdId: string, entryId: string) {
  await db
    .delete(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, entryId), eq(mealPlanEntries.householdId, householdId)));
}

export async function copyMealPlanEntry(
  householdId: string,
  userId: string,
  entryId: string,
  targetDate?: string,
  targetMealType?: MealType,
) {
  return db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(mealPlanEntries)
      .where(and(eq(mealPlanEntries.id, entryId), eq(mealPlanEntries.householdId, householdId)))
      .limit(1);

    if (!original) return null;

    const [copy] = await tx
      .insert(mealPlanEntries)
      .values({
        householdId,
        recipeId: original.recipeId,
        date: targetDate ?? original.date,
        mealType: targetMealType ?? original.mealType,
        servings: original.servings,
        notes: original.notes,
        status: original.status,
        isBatchCooking: original.isBatchCooking,
        createdBy: userId,
      })
      .returning();

    const assignments = await tx
      .select()
      .from(mealPlanAssignments)
      .where(eq(mealPlanAssignments.mealPlanEntryId, original.id));
    if (assignments.length) {
      await tx.insert(mealPlanAssignments).values(
        assignments.map((assignment) => ({
          mealPlanEntryId: copy.id,
          userId: assignment.userId,
          servings: assignment.servings,
        })),
      );
    }

    return copy;
  });
}

export async function copyPreviousWeek(
  householdId: string,
  userId: string,
  sourceWeekStart: string,
  targetWeekStart: string,
) {
  const sourceStart = parseISO(sourceWeekStart);
  const sourceEnd = addDays(sourceStart, 6);
  const targetStart = parseISO(targetWeekStart);
  const dayOffset = Math.round(
    (targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  return db.transaction(async (tx) => {
    const sourceEntries = await tx
      .select()
      .from(mealPlanEntries)
      .where(
        and(
          eq(mealPlanEntries.householdId, householdId),
          between(
            mealPlanEntries.date,
            format(sourceStart, "yyyy-MM-dd"),
            format(sourceEnd, "yyyy-MM-dd"),
          ),
        ),
      );

    if (!sourceEntries.length) return [];

    const sourceAssignments = await tx
      .select()
      .from(mealPlanAssignments)
      .where(inArray(mealPlanAssignments.mealPlanEntryId, sourceEntries.map((entry) => entry.id)));

    const copies = await tx
      .insert(mealPlanEntries)
      .values(
        sourceEntries.map((entry) => ({
          householdId,
          recipeId: entry.recipeId,
          date: format(addDays(parseISO(entry.date), dayOffset), "yyyy-MM-dd"),
          mealType: entry.mealType,
          servings: entry.servings,
          notes: entry.notes,
          status: entry.status,
          isBatchCooking: entry.isBatchCooking,
          createdBy: userId,
        })),
      )
      .returning();

    const copiedIdBySourceId = new Map(
      sourceEntries.map((entry, index) => [entry.id, copies[index].id]),
    );
    const assignmentsToCopy = sourceAssignments.flatMap((assignment) => {
      const copiedEntryId = copiedIdBySourceId.get(assignment.mealPlanEntryId);
      return copiedEntryId
        ? [{
            mealPlanEntryId: copiedEntryId,
            userId: assignment.userId,
            servings: assignment.servings,
          }]
        : [];
    });
    if (assignmentsToCopy.length) {
      await tx.insert(mealPlanAssignments).values(assignmentsToCopy);
    }

    return copies;
  });
}

export async function setAssignment(
  mealPlanEntryId: string,
  userId: string,
  servings: number,
) {
  if (servings === 0) {
    const [removed] = await db
      .delete(mealPlanAssignments)
      .where(
        and(
          eq(mealPlanAssignments.mealPlanEntryId, mealPlanEntryId),
          eq(mealPlanAssignments.userId, userId),
        ),
      )
      .returning();
    return removed ?? null;
  }

  const [existing] = await db
    .select()
    .from(mealPlanAssignments)
    .where(
      and(
        eq(mealPlanAssignments.mealPlanEntryId, mealPlanEntryId),
        eq(mealPlanAssignments.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(mealPlanAssignments)
      .set({ servings })
      .where(eq(mealPlanAssignments.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(mealPlanAssignments)
    .values({ mealPlanEntryId, userId, servings })
    .returning();
  return created;
}

export async function getAssignmentsForEntry(mealPlanEntryId: string) {
  return db
    .select()
    .from(mealPlanAssignments)
    .where(eq(mealPlanAssignments.mealPlanEntryId, mealPlanEntryId));
}

export async function getEntriesInDateRange(householdId: string, dateFrom: string, dateTo: string) {
  return db
    .select()
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        gte(mealPlanEntries.date, dateFrom),
        lte(mealPlanEntries.date, dateTo),
      ),
    );
}
