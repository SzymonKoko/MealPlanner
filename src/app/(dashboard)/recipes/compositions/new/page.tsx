import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import { CompositionForm } from "@/modules/recipes/components/composition-form";
import { getRecipeSourceOptions } from "@/modules/recipes/services/recipe-source-options";

export default async function NewCompositionPage() {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const sources = await getRecipeSourceOptions(householdId);
  return <DashboardShell><CompositionForm sources={sources} /></DashboardShell>;
}
