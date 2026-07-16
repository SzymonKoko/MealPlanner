import Link from "next/link";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Button } from "@/components/ui/button";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import { listIngredients } from "@/modules/ingredients/repository/ingredient-repository";
import { BarcodeScannerFlow } from "@/modules/ingredients/components/barcode-scanner-flow";

interface ScanPageProps {
  searchParams: Promise<{ barcode?: string; refresh?: string }>;
}

export default async function IngredientScanPage({ searchParams }: ScanPageProps) {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const params = await searchParams;
  const ingredients = await listIngredients(householdId);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Skanuj produkt</h1>
            <p className="text-sm text-muted-foreground">
              Najpierw szukamy produktu lokalnie, a dopiero potem w Open Food Facts.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/ingredients">Wróć do produktów</Link>
          </Button>
        </div>
        <BarcodeScannerFlow
          ingredients={ingredients.map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name,
          }))}
          initialBarcode={params.barcode}
          initialRefresh={params.refresh === "1"}
        />
      </div>
    </DashboardShell>
  );
}
