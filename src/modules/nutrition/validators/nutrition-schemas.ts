import { z } from "zod";

const optionalNonNegativeNumber = z
  .string()
  .regex(/^\d+([.,]\d+)?$/, "Wartość musi być liczbą nieujemną")
  .transform((value) => value.replace(",", "."))
  .optional();

export const nutritionGoalsSchema = z.object({
  kcalTarget: optionalNonNegativeNumber,
  proteinTarget: optionalNonNegativeNumber,
  carbsTarget: optionalNonNegativeNumber,
  fatTarget: optionalNonNegativeNumber,
  fiberTarget: optionalNonNegativeNumber,
});
