import { pgTable, uuid, text, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { households } from "./households";
import { users } from "./users";
import { ingredients, products, categories } from "./ingredients";

export const shoppingListSourceEnum = ["automatic", "manual"] as const;
export type ShoppingListSource = (typeof shoppingListSourceEnum)[number];

export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dateFrom: date("date_from"),
  dateTo: date("date_to"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingListItems = pgTable("shopping_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  shoppingListId: uuid("shopping_list_id")
    .notNull()
    .references(() => shoppingLists.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  requestedQuantity: text("requested_quantity").notNull(),
  pantryQuantity: text("pantry_quantity").notNull().default("0"),
  quantityToBuy: text("quantity_to_buy").notNull(),
  unit: text("unit").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  source: text("source").notNull().$type<ShoppingListSource>().default("automatic"),
  checked: boolean("checked").notNull().default(false),
  checkedBy: uuid("checked_by").references(() => users.id),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  notes: text("notes"),
});
