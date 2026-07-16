import { NextResponse } from "next/server";
import { requireActiveHousehold } from "@/server/require-household-member";
import { searchUsdaFoods, UsdaError } from "@/integrations/usda";
import { usdaSearchQuerySchema } from "@/modules/ingredients/validators/usda-import-schemas";

export async function GET(request: Request) {
  try {
    await requireActiveHousehold();
    const query = new URL(request.url).searchParams.get("query") ?? "";
    const parsed = usdaSearchQuerySchema.safeParse({ query });
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_query" }, { status: 400 });
    }

    const result = await searchUsdaFoods(parsed.data.query);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UsdaError) {
      const status =
        error.code === "CONFIG"
          ? 500
          : error.code === "TIMEOUT"
            ? 504
            : error.code === "RATE_LIMIT"
              ? 429
              : 502;
      return NextResponse.json({ error: error.code.toLowerCase(), message: error.message }, { status });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
