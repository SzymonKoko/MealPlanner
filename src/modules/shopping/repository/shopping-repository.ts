import { db } from "@/db/client";
import { shoppingLists, shoppingListItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { collectIngredientsFromPlan } from "../services/generate-shopping-list";

export async function getActiveShoppingList(householdId: string) {
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.householdId, householdId), eq(shoppingLists.status, "active")))
    .limit(1);
  return list ?? null;
}

export async function getShoppingListItems(shoppingListId: string) {
  return db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, shoppingListId))
    .orderBy(shoppingListItems.categoryId, shoppingListItems.name);
}

export async function generateShoppingList(
  householdId: string,
  name: string,
  dateFrom: string,
  dateTo: string,
) {
  const aggregated = await collectIngredientsFromPlan(householdId, dateFrom, dateTo);

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(shoppingLists)
      .where(and(eq(shoppingLists.householdId, householdId), eq(shoppingLists.status, "active")))
      .limit(1);

    let listId: string;
    let manualItems: (typeof shoppingListItems.$inferSelect)[] = [];

    if (existing.length) {
      listId = existing[0].id;
      manualItems = await tx
        .select()
        .from(shoppingListItems)
        .where(
          and(
            eq(shoppingListItems.shoppingListId, listId),
            eq(shoppingListItems.source, "manual"),
          ),
        );

      await tx
        .delete(shoppingListItems)
        .where(
          and(
            eq(shoppingListItems.shoppingListId, listId),
            eq(shoppingListItems.source, "automatic"),
          ),
        );

      await tx
        .update(shoppingLists)
        .set({ name, dateFrom, dateTo, updatedAt: new Date() })
        .where(eq(shoppingLists.id, listId));
    } else {
      const [list] = await tx
        .insert(shoppingLists)
        .values({ householdId, name, dateFrom, dateTo, status: "active" })
        .returning();
      listId = list.id;
    }

    if (aggregated.length) {
      await tx.insert(shoppingListItems).values(
        aggregated.map((item) => ({
          shoppingListId: listId,
          ingredientId: item.ingredientId,
          productId: item.productId,
          name: item.name,
          requestedQuantity: String(item.quantity),
          pantryQuantity: "0",
          quantityToBuy: String(item.quantity),
          unit: item.unit,
          categoryId: item.categoryId,
          source: "automatic" as const,
        })),
      );
    }

    return { listId, manualItemsPreserved: manualItems.length };
  });
}

export async function addManualItem(
  shoppingListId: string,
  data: {
    name: string;
    quantityToBuy: string;
    unit: string;
    notes?: string;
  },
) {
  const [item] = await db
    .insert(shoppingListItems)
    .values({
      shoppingListId,
      name: data.name,
      requestedQuantity: data.quantityToBuy,
      pantryQuantity: "0",
      quantityToBuy: data.quantityToBuy,
      unit: data.unit,
      source: "manual",
      notes: data.notes,
    })
    .returning();
  return item;
}

export async function toggleItemChecked(
  itemId: string,
  checked: boolean,
  userId: string,
) {
  const [item] = await db
    .update(shoppingListItems)
    .set({
      checked,
      checkedBy: checked ? userId : null,
      checkedAt: checked ? new Date() : null,
    })
    .where(eq(shoppingListItems.id, itemId))
    .returning();
  return item;
}

export async function getShoppingListWithItems(householdId: string) {
  const list = await getActiveShoppingList(householdId);
  if (!list) return null;

  const items = await getShoppingListItems(list.id);
  return { list, items };
}
