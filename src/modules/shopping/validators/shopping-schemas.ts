import { z } from "zod";
import { SUPPORTED_UNITS } from "@/lib/units";

export const generateShoppingListSchema = z.object({
  name: z.string().min(1).max(100),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const manualItemSchema = z.object({
  shoppingListId: z.string().uuid(),
  name: z.string().min(1).max(200),
  quantityToBuy: z.string().min(1),
  unit: z.enum(SUPPORTED_UNITS),
  notes: z.string().max(500).optional(),
});

export const toggleItemSchema = z.object({
  itemId: z.string().uuid(),
  checked: z.boolean(),
});
