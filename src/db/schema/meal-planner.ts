import { pgTable, uuid, text, integer, numeric, timestamp, date, uniqueIndex, boolean, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { households } from "./households";
import { users } from "./users";
import { recipes } from "./recipes";
import { ingredients, products } from "./ingredients";

export const mealTypeEnum = [
  "breakfast",
  "secondBreakfast",
  "lunch",
  "dinner",
  "snack",
] as const;
export type MealType = (typeof mealTypeEnum)[number];

export const mealPlanEntries = pgTable("meal_plan_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  mealType: text("meal_type").notNull().$type<MealType>(),
  servings: integer("servings").notNull().default(1),
  quantity: numeric("quantity", { precision: 12, scale: 4 }),
  unit: text("unit"),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  isBatchCooking: boolean("is_batch_cooking").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mealPlanAssignments = pgTable(
  "meal_plan_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mealPlanEntryId: uuid("meal_plan_entry_id")
      .notNull()
      .references(() => mealPlanEntries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    share: numeric("share", { precision: 9, scale: 8 }).notNull(),
  },
  (table) => [
    uniqueIndex("meal_plan_assignments_entry_user_idx").on(table.mealPlanEntryId, table.userId),
    check("meal_plan_assignments_share_check", sql`${table.share} > 0 AND ${table.share} <= 1`),
  ],
);
