import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authProviderId: text("auth_provider_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  activeHouseholdId: uuid("active_household_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userNutritionGoals = pgTable("user_nutrition_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  kcalTarget: text("kcal_target"),
  proteinTarget: text("protein_target"),
  carbsTarget: text("carbs_target"),
  fatTarget: text("fat_target"),
  fiberTarget: text("fiber_target"),
});
