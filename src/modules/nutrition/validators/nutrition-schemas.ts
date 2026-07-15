import { z } from "zod";

export const nutritionGoalsSchema = z.object({
  kcalTarget: z.string().optional(),
  proteinTarget: z.string().optional(),
  carbsTarget: z.string().optional(),
  fatTarget: z.string().optional(),
  fiberTarget: z.string().optional(),
});
