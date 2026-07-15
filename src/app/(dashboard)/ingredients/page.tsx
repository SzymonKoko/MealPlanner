import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHousehold } from "@/server/require-household-member";
import {
  listIngredients,
  listProducts,
} from "@/modules/ingredients/repository/ingredient-repository";
import {
  createIngredientAction,
  createProductAction,
  deleteIngredientFormAction,
} from "@/modules/ingredients/actions/ingredient-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function IngredientsPage() {
  const { householdId } = await requireActiveHousehold();
  const [ingredients, products] = await Promise.all([
    listIngredients(householdId),
    listProducts(householdId),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Składniki i produkty</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Dodaj składnik</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createIngredientAction} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ing-name">Nazwa</Label>
                  <Input id="ing-name" name="name" required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="kcal">kcal/100</Label>
                    <Input id="kcal" name="kcalPer100" type="number" step="0.1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protein">Białko/100</Label>
                    <Input id="protein" name="proteinPer100" type="number" step="0.1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbs">Węgle/100</Label>
                    <Input id="carbs" name="carbsPer100" type="number" step="0.1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fat">Tłuszcze/100</Label>
                    <Input id="fat" name="fatPer100" type="number" step="0.1" />
                  </div>
                </div>
                <Button type="submit">Dodaj składnik</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dodaj produkt</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createProductAction} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="prod-name">Nazwa</Label>
                  <Input id="prod-name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Marka</Label>
                  <Input id="brand" name="brand" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ingredientId">Powiązany składnik</Label>
                  <select
                    id="ingredientId"
                    name="ingredientId"
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">— brak —</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit">Dodaj produkt</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Składniki ({ingredients.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ingredients.length === 0 ? (
              <p className="text-muted-foreground">Brak składników.</p>
            ) : (
              ingredients.map((ing) => (
                <div key={ing.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{ing.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {ing.kcalPer100 ? `${ing.kcalPer100} kcal/100${ing.baseUnit}` : "Brak makro"}
                    </p>
                  </div>
                  <form action={deleteIngredientFormAction}>
                    <input type="hidden" name="id" value={ing.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      Usuń
                    </Button>
                  </form>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produkty ({products.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.length === 0 ? (
              <p className="text-muted-foreground">Brak produktów.</p>
            ) : (
              products.map((prod) => (
                <div key={prod.id} className="rounded-lg border p-3">
                  <p className="font-medium">{prod.name}</p>
                  {prod.brand ? <p className="text-sm text-muted-foreground">{prod.brand}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
