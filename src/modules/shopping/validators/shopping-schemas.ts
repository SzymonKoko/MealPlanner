import { z } from "zod";
import { SUPPORTED_UNITS } from "@/lib/units";

export const generateShoppingListSchema = z
  .object({
    name: z.string().min(1).max(100),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((value) => value.dateFrom <= value.dateTo, {
    message: "Data końcowa nie może być wcześniejsza niż początkowa",
    path: ["dateTo"],
  });

export const manualItemSchema = z.object({
  shoppingListId: z.string().uuid(),
  name: z.string().min(1).max(200),
  quantityToBuy: z
    .string()
    .trim()
    .regex(/^\d+(?:[.,]\d+)?$/, "Ilość musi być liczbą")
    .transform((value) => value.replace(",", "."))
    .refine((value) => Number(value) > 0, "Ilość musi być większa od zera"),
  unit: z.enum(SUPPORTED_UNITS),
  notes: z.string().max(500).optional(),
});

export const toggleItemSchema = z.object({
  itemId: z.string().uuid(),
  checked: z.boolean(),
});
