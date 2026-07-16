import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export async function GET() {
  try {
    const devBypass =
      process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";
    if (
      !process.env.AUTH_SECRET ||
      (!process.env.AUTH_URL && !devBypass) ||
      (!devBypass &&
        (!process.env.AUTHENTIK_ISSUER ||
          !process.env.AUTHENTIK_CLIENT_ID ||
          !process.env.AUTHENTIK_CLIENT_SECRET))
    ) {
      throw new Error("Missing authentication configuration");
    }

    await db.execute(sql`
      DO $$
      BEGIN
        IF to_regclass('public.users') IS NULL
          OR to_regclass('public.households') IS NULL
          OR to_regclass('public.recipes') IS NULL
          OR to_regclass('public.meal_plan_entries') IS NULL
          OR to_regclass('public.shopping_lists') IS NULL
        THEN
          RAISE EXCEPTION 'Database schema is incomplete';
        END IF;
        IF NOT EXISTS (
          SELECT 1
          FROM schema_migrations
          WHERE filename = '0005_single_household_owner.sql'
            AND checksum IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'Database migrations are incomplete';
        END IF;
      END
      $$;
    `);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error(
      "Health check failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
