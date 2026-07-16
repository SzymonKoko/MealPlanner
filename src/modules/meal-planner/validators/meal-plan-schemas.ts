import { z } from "zod";
import { mealTypeEnum } from "@/db/schema/meal-planner";

export const mealPlanEntrySchema = z.object({
  recipeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(mealTypeEnum),
  servings: z.coerce.number().int().min(1).default(1),
  notes: z.string().max(500).optional(),
});

export const moveMealPlanEntrySchema = z.object({
  entryId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(mealTypeEnum),
});

export const assignmentSchema = z.object({
  mealPlanEntryId: z.string().uuid(),
  userId: z.string().uuid(),
  servings: z.coerce.number().int().min(0),
});

export const mealPlanDetailsSchema = z.object({
  entryId: z.string().uuid(),
  servings: z.coerce.number().int().min(1),
  notes: z.string().max(500).optional(),
  status: z.enum(["planned", "prepared", "eaten"]).default("planned"),
  isBatchCooking: z.coerce.boolean().default(false),
});

export const copyWeekSchema = z.object({
  sourceWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
