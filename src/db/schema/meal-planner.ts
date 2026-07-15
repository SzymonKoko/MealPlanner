import { pgTable, uuid, text, integer, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { households } from "./households";
import { users } from "./users";
import { recipes } from "./recipes";

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
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  mealType: text("meal_type").notNull().$type<MealType>(),
  servings: integer("servings").notNull().default(1),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
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
    servings: integer("servings").notNull().default(1),
  },
  (table) => [
    uniqueIndex("meal_plan_assignments_entry_user_idx").on(table.mealPlanEntryId, table.userId),
  ],
);
