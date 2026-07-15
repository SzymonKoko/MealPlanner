import { pgTable, uuid, text, integer, timestamp, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { households } from "./households";
import { users } from "./users";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
  },
  (table) => [uniqueIndex("tags_household_name_type_idx").on(table.householdId, table.name, table.type)],
);

export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  baseUnit: text("base_unit").notNull().default("g"),
  kcalPer100: text("kcal_per_100"),
  proteinPer100: text("protein_per_100"),
  carbsPer100: text("carbs_per_100"),
  fatPer100: text("fat_per_100"),
  fiberPer100: text("fiber_per_100"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  brand: text("brand"),
  barcode: text("barcode"),
  packageQuantity: text("package_quantity"),
  packageUnit: text("package_unit"),
  kcalPer100: text("kcal_per_100"),
  proteinPer100: text("protein_per_100"),
  carbsPer100: text("carbs_per_100"),
  fatPer100: text("fat_per_100"),
  fiberPer100: text("fiber_per_100"),
  source: text("source"),
  externalId: text("external_id"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingredientTags = pgTable(
  "ingredient_tags",
  {
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.ingredientId, table.tagId] })],
);

export const productTags = pgTable(
  "product_tags",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.productId, table.tagId] })],
);
