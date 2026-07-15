import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHousehold } from "@/server/require-household-member";
import { getShoppingListWithItems } from "@/modules/shopping/repository/shopping-repository";
import { generateShoppingListAction } from "@/modules/shopping/actions/shopping-actions";
import { formatDateISO, getWeekStart, getWeekEnd } from "@/lib/dates";
import { ShoppingListView } from "@/modules/shopping/components/shopping-list-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ShoppingPage() {
  const { householdId } = await requireActiveHousehold();
  const data = await getShoppingListWithItems(householdId);

  const weekStart = formatDateISO(getWeekStart());
  const weekEnd = formatDateISO(getWeekEnd());

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lista zakupów</h1>
        </div>

        <form action={generateShoppingListAction}>
          <input type="hidden" name="name" value="Lista tygodniowa" />
          <input type="hidden" name="dateFrom" value={weekStart} />
          <input type="hidden" name="dateTo" value={weekEnd} />
          <Button type="submit">Generuj z planera</Button>
        </form>

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
            }))}
          />
        )}
      </div>
    </DashboardShell>
  );
}
