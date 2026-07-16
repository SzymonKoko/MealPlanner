import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import {
  getRecipeTags,
  getRecipeWithIngredients,
} from "@/modules/recipes/repository/recipe-repository";
import {
  listIngredients,
  listProducts,
  listTags,
  getIngredientUnitConversions,
} from "@/modules/ingredients/repository/ingredient-repository";
import { RecipeForm } from "@/modules/recipes/components/recipe-form";

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const { id } = await params;
  const [data, ingredients, products, tags, selectedTags] = await Promise.all([
    getRecipeWithIngredients(householdId, id),
    listIngredients(householdId),
    listProducts(householdId),
    listTags(householdId, "recipe"),
    getRecipeTags(id),
  ]);
  if (!data) notFound();
  const ingredientConversions = await getIngredientUnitConversions(ingredients.map((ingredient) => ingredient.id));
  const conversionsByIngredient = new Map<string, typeof ingredientConversions>();
  for (const conversion of ingredientConversions) {
    const current = conversionsByIngredient.get(conversion.ingredientId) ?? [];
    current.push(conversion);
    conversionsByIngredient.set(conversion.ingredientId, current);
  }

  return (
    <DashboardShell>
      <RecipeForm
        sources={[
          ...ingredients.map((item) => ({
            id: item.id,
            name: item.name,
            type: "ingredient" as const,
            nutritionBasis: item.nutritionBasis,
            kcalPer100: item.kcalPer100,
            proteinPer100: item.proteinPer100,
            carbsPer100: item.carbsPer100,
            fatPer100: item.fatPer100,
            fiberPer100: item.fiberPer100,
            saltPer100: item.saltPer100,
            densityGramsPerMl: item.densityGramsPerMl,
            unitConversions: conversionsByIngredient.get(item.id) ?? [],
          })),
          ...products.map((item) => ({
            id: item.id,
            name: item.name,
            type: "product" as const,
            nutritionBasis: item.nutritionBasis,
            kcalPer100: item.kcalPer100,
            proteinPer100: item.proteinPer100,
            carbsPer100: item.carbsPer100,
            fatPer100: item.fatPer100,
            fiberPer100: item.fiberPer100,
            saltPer100: item.saltPer100,
            densityGramsPerMl:
              ingredients.find((ingredient) => ingredient.id === item.ingredientId)
                ?.densityGramsPerMl ?? null,
            unitConversions: item.ingredientId
              ? conversionsByIngredient.get(item.ingredientId) ?? []
              : [],
            packageQuantity: item.packageQuantity,
            packageUnit: item.packageUnit,
          })),
        ]}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
        initialData={{
          ...data.recipe,
          tagIds: selectedTags.map((tag) => tag.tagId),
          ingredients: data.ingredients.map((item) => ({
            ingredientId: item.ingredientId,
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            optional: item.optional,
          })),
        }}
      />
    </DashboardShell>
  );
}
