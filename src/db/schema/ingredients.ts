import {
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { households } from "./households";
import { users } from "./users";
import { sql } from "drizzle-orm";

export const nutritionBasisEnum = ["per100g", "per100ml"] as const;
export type NutritionBasis = (typeof nutritionBasisEnum)[number];

export const nutritionDataSourceEnum = [
  "manual",
  "open_food_facts",
  "usda",
  "nutrition_label_ocr",
  "household_override",
] as const;
export type NutritionDataSource = (typeof nutritionDataSourceEnum)[number];

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
  nutritionBasis: text("nutrition_basis").notNull().$type<NutritionBasis>().default("per100g"),
  kcalPer100: numeric("kcal_per_100", { precision: 12, scale: 4 }),
  proteinPer100: numeric("protein_per_100", { precision: 12, scale: 4 }),
  carbsPer100: numeric("carbs_per_100", { precision: 12, scale: 4 }),
  fatPer100: numeric("fat_per_100", { precision: 12, scale: 4 }),
  fiberPer100: numeric("fiber_per_100", { precision: 12, scale: 4 }),
  saltPer100: numeric("salt_per_100", { precision: 12, scale: 4 }),
  densityGramsPerMl: text("density_grams_per_ml"),
  allergens: text("allergens"),
  dataSource: text("data_source").notNull().$type<NutritionDataSource>().default("manual"),
  externalId: text("external_id"),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  verifiedByUser: boolean("verified_by_user").notNull().default(false),
  manuallyModified: boolean("manually_modified").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("ingredients_household_source_external_idx")
    .on(table.householdId, table.dataSource, table.externalId)
    .where(sql`${table.externalId} is not null`),
]);

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
  nutritionBasis: text("nutrition_basis").notNull().$type<NutritionBasis>().default("per100g"),
  kcalPer100: numeric("kcal_per_100", { precision: 12, scale: 4 }),
  proteinPer100: numeric("protein_per_100", { precision: 12, scale: 4 }),
  carbsPer100: numeric("carbs_per_100", { precision: 12, scale: 4 }),
  fatPer100: numeric("fat_per_100", { precision: 12, scale: 4 }),
  fiberPer100: numeric("fiber_per_100", { precision: 12, scale: 4 }),
  saltPer100: numeric("salt_per_100", { precision: 12, scale: 4 }),
  dataSource: text("data_source").notNull().$type<NutritionDataSource>().default("manual"),
  externalId: text("external_id"),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  verifiedByUser: boolean("verified_by_user").notNull().default(false),
  manuallyModified: boolean("manually_modified").notNull().default(false),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("products_household_source_external_idx")
    .on(table.householdId, table.dataSource, table.externalId)
    .where(sql`${table.externalId} is not null`),
  uniqueIndex("products_household_barcode_idx")
    .on(table.householdId, table.barcode)
    .where(sql`${table.barcode} is not null`),
]);

export const ingredientUnitConversions = pgTable(
  "ingredient_unit_conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    unit: text("unit").notNull(),
    gramsEquivalent: numeric("grams_equivalent", { precision: 12, scale: 4 }).notNull(),
    label: text("label"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ingredient_unit_conversions_unique_unit_idx").on(table.ingredientId, table.unit),
  ],
);

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
