"use server";

import { revalidatePath } from "next/cache";
import { requireActiveHousehold } from "@/server/require-household-member";
import {
  generateShoppingListSchema,
  manualItemSchema,
  toggleItemSchema,
} from "../validators/shopping-schemas";
import {
  generateShoppingList,
  addManualItem,
  toggleItemChecked,
  getShoppingListWithItems,
} from "../repository/shopping-repository";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { shoppingListItems, shoppingLists } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function generateShoppingListAction(formData: FormData) {
  const { householdId } = await requireActiveHousehold();
  const parsed = generateShoppingListSchema.safeParse({
    name: formData.get("name"),
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await generateShoppingList(
    householdId,
    parsed.data.name,
    parsed.data.dateFrom,
    parsed.data.dateTo,
  );
  revalidatePath("/shopping");
}

export async function addManualShoppingItemAction(formData: FormData) {
  const { householdId } = await requireActiveHousehold();
  const parsed = manualItemSchema.safeParse({
    shoppingListId: formData.get("shoppingListId"),
    name: formData.get("name"),
    quantityToBuy: formData.get("quantityToBuy"),
    unit: formData.get("unit"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(
      and(
        eq(shoppingLists.id, parsed.data.shoppingListId),
        eq(shoppingLists.householdId, householdId),
      ),
    )
    .limit(1);

  if (!list) throw new AppError("Lista zakupów nie istnieje", "NOT_FOUND", 404);

  await addManualItem(parsed.data.shoppingListId, parsed.data);
  revalidatePath("/shopping");
}

export async function toggleShoppingItemAction(formData: FormData) {
  const { user, householdId } = await requireActiveHousehold();
  const parsed = toggleItemSchema.safeParse({
    itemId: formData.get("itemId"),
    checked: formData.get("checked") === "true",
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const [item] = await db
    .select({ item: shoppingListItems, list: shoppingLists })
    .from(shoppingListItems)
    .innerJoin(shoppingLists, eq(shoppingListItems.shoppingListId, shoppingLists.id))
    .where(eq(shoppingListItems.id, parsed.data.itemId))
    .limit(1);

  if (!item || item.list.householdId !== householdId) {
    throw new AppError("Pozycja nie istnieje", "NOT_FOUND", 404);
  }

  await toggleItemChecked(parsed.data.itemId, parsed.data.checked, user.id);
  revalidatePath("/shopping");
}

export async function getShoppingListAction() {
  const { householdId } = await requireActiveHousehold();
  return getShoppingListWithItems(householdId);
}
