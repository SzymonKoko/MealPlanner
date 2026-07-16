import { z } from "zod";
import { mealTypeEnum } from "@/db/schema/meal-planner";

function optionalUuid() {
  return z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.string().uuid().optional(),
  );
}

export const mealPlanEntrySchema = z
  .object({
    recipeId: optionalUuid(),
    ingredientId: optionalUuid(),
    productId: optionalUuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealType: z.enum(mealTypeEnum),
    servings: z.coerce.number().int().min(1).default(1),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const sources = [data.recipeId, data.ingredientId, data.productId].filter(Boolean);
    if (sources.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wybierz dokładnie jeden przepis lub składnik",
      });
    }
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
