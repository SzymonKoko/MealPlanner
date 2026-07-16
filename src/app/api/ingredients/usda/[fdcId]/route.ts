import { NextResponse } from "next/server";
import { requireActiveHousehold } from "@/server/require-household-member";
import { getUsdaFoodDetails, UsdaError } from "@/integrations/usda";
import { usdaFoodIdSchema } from "@/modules/ingredients/validators/usda-import-schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fdcId: string }> },
) {
  try {
    await requireActiveHousehold();
    const parsed = usdaFoodIdSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_fdc_id" }, { status: 400 });
    }
    const result = await getUsdaFoodDetails(parsed.data.fdcId);
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
              : error.code === "NOT_FOUND"
                ? 404
                : 502;
      return NextResponse.json({ error: error.code.toLowerCase(), message: error.message }, { status });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
