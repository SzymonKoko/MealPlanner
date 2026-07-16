import { NextResponse } from "next/server";
import { requireActiveHousehold } from "@/server/require-household-member";
import { getShoppingListWithItems } from "@/modules/shopping/repository/shopping-repository";
import { listCategories } from "@/modules/ingredients/repository/ingredient-repository";

export async function GET() {
  try {
    const { householdId } = await requireActiveHousehold();
    const [data, categories] = await Promise.all([
      getShoppingListWithItems(householdId),
      listCategories(householdId),
    ]);
    if (!data) {
      return NextResponse.json({ list: null, items: [] });
    }
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    return NextResponse.json({
      items: data.items.map((item) => ({
        ...item,
        categoryName: item.categoryId ? categoryNames.get(item.categoryId) ?? "Inne" : "Inne",
      })),
      list: data.list,
    });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
