import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import { CompositionForm } from "@/modules/recipes/components/composition-form";
import { getComposition } from "@/modules/recipes/repository/recipe-repository";
import { getRecipeSourceOptions } from "@/modules/recipes/services/recipe-source-options";

export default async function EditCompositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const { id } = await params;
  const [composition, sources] = await Promise.all([getComposition(householdId, id), getRecipeSourceOptions(householdId)]);
  if (!composition) notFound();
  return <DashboardShell><CompositionForm sources={sources} initialData={{
    id: composition.recipe.id,
    name: composition.recipe.name,
    description: composition.recipe.description,
    sections: composition.sections,
  }} /></DashboardShell>;
}
