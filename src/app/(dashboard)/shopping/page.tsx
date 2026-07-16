import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdOrRedirect } from "@/server/require-household-member";
import { getShoppingListWithItems } from "@/modules/shopping/repository/shopping-repository";
import { formatDateISO, getWeekStart, getWeekEnd } from "@/lib/dates";
import { ShoppingListView } from "@/modules/shopping/components/shopping-list-view";
import { GenerateShoppingForm } from "@/modules/shopping/components/generate-shopping-form";
import { Card, CardContent } from "@/components/ui/card";
import { listCategories } from "@/modules/ingredients/repository/ingredient-repository";
import { canEdit } from "@/modules/households/services/role-checks";

export default async function ShoppingPage() {
  const { householdId, role } = await requireActiveHouseholdOrRedirect();
  const [data, categories] = await Promise.all([
    getShoppingListWithItems(householdId),
    listCategories(householdId),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const weekStart = formatDateISO(getWeekStart());
  const weekEnd = formatDateISO(getWeekEnd());

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lista zakupów</h1>
        </div>

        {canEdit(role) ? (
          <GenerateShoppingForm
            defaultName={data?.list.name ?? "Lista zakupów"}
            defaultDateFrom={data?.list.dateFrom ?? weekStart}
            defaultDateTo={data?.list.dateTo ?? weekEnd}
          />
        ) : null}

        {!data ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Brak aktywnej listy zakupów. Wygeneruj listę z planera tygodniowego.
            </CardContent>
          </Card>
        ) : (
          <ShoppingListView
            listId={data.list.id}
            items={data.items.map((i) => ({
              id: i.id,
              name: i.name,
              quantityToBuy: i.quantityToBuy,
              unit: i.unit,
              checked: i.checked,
              source: i.source,
              categoryId: i.categoryId,
              categoryName: i.categoryId ? categoryNames.get(i.categoryId) ?? "Inne" : "Inne",
              notes: i.notes,
            }))}
            editable={canEdit(role)}
          />
        )}
      </div>
    </DashboardShell>
  );
}
