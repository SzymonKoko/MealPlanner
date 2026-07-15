import { NextResponse } from "next/server";
import { requireActiveHousehold } from "@/server/require-household-member";
import { getShoppingListWithItems } from "@/modules/shopping/repository/shopping-repository";

export async function GET() {
  try {
    const { householdId } = await requireActiveHousehold();
    const data = await getShoppingListWithItems(householdId);
    if (!data) {
      return NextResponse.json({ items: [] });
    }
    return NextResponse.json({ items: data.items, list: data.list });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
