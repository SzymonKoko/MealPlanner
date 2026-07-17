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
    quantity: z.coerce.number().positive().optional(),
    unit: z.string().max(20).optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const sources = [data.recipeId, data.ingredientId, data.productId].filter(Boolean);
    if (sources.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wybierz dokładnie jeden przepis lub składnik",
      });
      return;
    }
    if (data.recipeId) return;
    if (!data.quantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "Podaj gramaturę",
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
  servings: z.coerce.number().int().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
  isBatchCooking: z.coerce.boolean().default(false),
});

export const copyWeekSchema = z.object({
  sourceWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
