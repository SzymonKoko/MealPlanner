import { pgTable, uuid, text, integer, boolean, timestamp, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { households } from "./households";
import { users } from "./users";
import { ingredients, products } from "./ingredients";
import { tags } from "./ingredients";

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("standard").$type<"standard" | "composition" | "composition_instance">(),
  description: text("description"),
  instructions: text("instructions"),
  servings: integer("servings").notNull().default(1),
  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  imageUrl: text("image_url"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const compositionSections = pgTable("composition_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const compositionOptions = pgTable(
  "composition_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => compositionSections.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    quantity: text("quantity").notNull(),
    unit: text("unit").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    check(
      "composition_options_exactly_one_source_check",
      sql`((${table.ingredientId} IS NOT NULL)::int + (${table.productId} IS NOT NULL)::int) = 1`,
    ),
  ],
);

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  quantity: text("quantity").notNull(),
  unit: text("unit").notNull(),
  optional: boolean("optional").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const recipeTags = pgTable(
  "recipe_tags",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.tagId] })],
);
