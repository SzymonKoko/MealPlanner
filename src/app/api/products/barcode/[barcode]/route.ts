import { NextResponse } from "next/server";
import { requireActiveHousehold } from "@/server/require-household-member";
import { productImportLookupSchema } from "@/modules/ingredients/validators/barcode-import-schemas";
import { lookupBarcodeProduct } from "@/modules/ingredients/services/barcode-import";
import { OpenFoodFactsError } from "@/integrations/open-food-facts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ barcode: string }> },
) {
  try {
    const { householdId } = await requireActiveHousehold();
    const searchParams = new URL(request.url).searchParams;
    const parsed = productImportLookupSchema.safeParse({
      barcode: (await params).barcode,
      refresh: searchParams.get("refresh") === "1",
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_barcode" }, { status: 400 });
    }

    const result = await lookupBarcodeProduct(
      householdId,
      parsed.data.barcode,
      parsed.data.refresh,
    );
    if (result.status === "not_found") {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OpenFoodFactsError) {
      const status =
        error.code === "TIMEOUT"
          ? 504
          : error.code === "RATE_LIMIT"
            ? 429
            : error.code === "NOT_FOUND"
              ? 404
              : 502;
      return NextResponse.json(
        { error: error.code.toLowerCase(), message: error.message },
        { status },
      );
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
