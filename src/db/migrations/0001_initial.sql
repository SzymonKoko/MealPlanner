-- Migration 001: Initial MVP schema

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "auth_provider_id" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "active_household_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_nutrition_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "kcal_target" text,
  "protein_target" text,
  "carbs_target" text,
  "fat_target" text,
  "fiber_target" text
);

CREATE TABLE IF NOT EXISTS "households" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "household_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "household_members_household_user_idx" ON "household_members" ("household_id", "user_id");

CREATE TABLE IF NOT EXISTS "household_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "email" text,
  "role" text DEFAULT 'member' NOT NULL,
  "token" text NOT NULL UNIQUE,
  "invited_by" uuid NOT NULL REFERENCES "users"("id"),
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "tags_household_name_type_idx" ON "tags" ("household_id", "name", "type");

CREATE TABLE IF NOT EXISTS "ingredients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "base_unit" text DEFAULT 'g' NOT NULL,
  "kcal_per_100" text,
  "protein_per_100" text,
  "carbs_per_100" text,
  "fat_per_100" text,
  "fiber_per_100" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "ingredient_id" uuid REFERENCES "ingredients"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "brand" text,
  "barcode" text,
  "package_quantity" text,
  "package_unit" text,
  "kcal_per_100" text,
  "protein_per_100" text,
  "carbs_per_100" text,
  "fat_per_100" text,
  "fiber_per_100" text,
  "source" text,
  "external_id" text,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ingredient_tags" (
  "ingredient_id" uuid NOT NULL REFERENCES "ingredients"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("ingredient_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "product_tags" (
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("product_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "recipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "instructions" text,
  "servings" integer DEFAULT 1 NOT NULL,
  "prep_time_minutes" integer,
  "cook_time_minutes" integer,
  "image_url" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipe_id" uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "ingredient_id" uuid REFERENCES "ingredients"("id") ON DELETE SET NULL,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "quantity" text NOT NULL,
  "unit" text NOT NULL,
  "optional" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipe_tags" (
  "recipe_id" uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("recipe_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "meal_plan_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "recipe_id" uuid NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "meal_type" text NOT NULL,
  "servings" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'planned' NOT NULL,
  "notes" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "meal_plan_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meal_plan_entry_id" uuid NOT NULL REFERENCES "meal_plan_entries"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "servings" integer DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "meal_plan_assignments_entry_user_idx" ON "meal_plan_assignments" ("meal_plan_entry_id", "user_id");

CREATE TABLE IF NOT EXISTS "shopping_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "date_from" date,
  "date_to" date,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shopping_list_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shopping_list_id" uuid NOT NULL REFERENCES "shopping_lists"("id") ON DELETE CASCADE,
  "ingredient_id" uuid REFERENCES "ingredients"("id") ON DELETE SET NULL,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "requested_quantity" text NOT NULL,
  "pantry_quantity" text DEFAULT '0' NOT NULL,
  "quantity_to_buy" text NOT NULL,
  "unit" text NOT NULL,
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "source" text DEFAULT 'automatic' NOT NULL,
  "checked" boolean DEFAULT false NOT NULL,
  "checked_by" uuid REFERENCES "users"("id"),
  "checked_at" timestamp with time zone,
  "notes" text
);

CREATE INDEX IF NOT EXISTS "ingredients_household_idx" ON "ingredients" ("household_id");
CREATE INDEX IF NOT EXISTS "products_household_idx" ON "products" ("household_id");
CREATE INDEX IF NOT EXISTS "recipes_household_idx" ON "recipes" ("household_id");
CREATE INDEX IF NOT EXISTS "meal_plan_entries_household_date_idx" ON "meal_plan_entries" ("household_id", "date");
CREATE INDEX IF NOT EXISTS "shopping_list_items_list_idx" ON "shopping_list_items" ("shopping_list_id");
