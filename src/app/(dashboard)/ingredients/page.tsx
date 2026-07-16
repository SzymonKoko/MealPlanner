import { DashboardShell } from "@/components/shared/dashboard-shell";
import Link from "next/link";
import { requireActiveHouseholdOrRedirect } from "@/server/require-household-member";
import {
  listIngredients,
  listProducts,
  listCategories,
  listTags,
  getIngredientTags,
  getProductTags,
  getIngredientUnitConversions,
} from "@/modules/ingredients/repository/ingredient-repository";
import {
  createIngredientAction,
  createProductAction,
  updateIngredientAction,
  deleteIngredientAction,
  updateProductAction,
  deleteProductAction,
  createCategoryAction,
  deleteCategoryAction,
  createTagAction,
  deleteTagAction,
  updateCategoryAction,
  updateTagAction,
  replaceIngredientUnitConversionsAction,
} from "@/modules/ingredients/actions/ingredient-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORTED_UNITS } from "@/lib/units";
import { canEdit } from "@/modules/households/services/role-checks";

type Ingredient = Awaited<ReturnType<typeof listIngredients>>[number];
type Product = Awaited<ReturnType<typeof listProducts>>[number];
type Category = Awaited<ReturnType<typeof listCategories>>[number];
type Tag = Awaited<ReturnType<typeof listTags>>[number];
type FormAction = (formData: FormData) => Promise<void>;
type IngredientUnitConversion = Awaited<ReturnType<typeof getIngredientUnitConversions>>[number];

function NutritionFields({
  values,
  prefix,
}: {
  values?: Pick<
    Ingredient | Product,
    | "nutritionBasis"
    | "kcalPer100"
    | "proteinPer100"
    | "carbsPer100"
    | "fatPer100"
    | "fiberPer100"
    | "saltPer100"
  >;
  prefix: string;
}) {
  const fields = [
    ["kcalPer100", "kcal"],
    ["proteinPer100", "Białko"],
    ["carbsPer100", "Węgle"],
    ["fatPer100", "Tłuszcze"],
    ["fiberPer100", "Błonnik"],
    ["saltPer100", "Sól"],
  ] as const;
  const basisLabel = values?.nutritionBasis === "per100ml" ? "100 ml" : "100 g";
  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Wartości odżywcze (na {basisLabel})</legend>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-nutritionBasis`}>Podstawa danych</Label>
        <select
          id={`${prefix}-nutritionBasis`}
          name="nutritionBasis"
          defaultValue={values?.nutritionBasis ?? "per100g"}
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="per100g">na 100 g</option>
          <option value="per100ml">na 100 ml</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map(([name, label]) => (
          <div className="flex min-w-0 flex-col gap-2" key={name}>
            <Label htmlFor={`${prefix}-${name}`} className="min-h-10 leading-tight">
              {label}
            </Label>
            <Input
              id={`${prefix}-${name}`}
              name={name}
              type="number"
              min="0"
              step="0.0001"
              inputMode="decimal"
              defaultValue={values?.[name] ?? ""}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function IngredientForm({
  action,
  ingredient,
  categories,
  tags,
  selectedTagIds = new Set<string>(),
  submitLabel,
}: {
  action: FormAction;
  ingredient?: Ingredient;
  categories: Category[];
  tags: Tag[];
  selectedTagIds?: Set<string>;
  submitLabel: string;
}) {
  const prefix = ingredient?.id ?? "new-ingredient";
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-name`}>Nazwa</Label>
          <Input id={`${prefix}-name`} name="name" defaultValue={ingredient?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-category`}>Kategoria</Label>
          <select
            id={`${prefix}-category`}
            name="categoryId"
            defaultValue={ingredient?.categoryId ?? ""}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Bez kategorii</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-description`}>Opis</Label>
        <Input id={`${prefix}-description`} name="description" defaultValue={ingredient?.description ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-unit`}>Jednostka bazowa</Label>
        <select
          id={`${prefix}-unit`}
          name="baseUnit"
          defaultValue={ingredient?.baseUnit ?? "g"}
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          {SUPPORTED_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
      </div>
      <NutritionFields values={ingredient} prefix={prefix} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-density`}>Gęstość (g/ml, opcjonalnie)</Label>
          <Input
            id={`${prefix}-density`}
            name="densityGramsPerMl"
            type="number"
            min="0.001"
            step="0.001"
            defaultValue={ingredient?.densityGramsPerMl ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-allergens`}>Alergeny</Label>
          <Input
            id={`${prefix}-allergens`}
            name="allergens"
            defaultValue={ingredient?.allergens ?? ""}
            placeholder="np. gluten, orzechy"
          />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="verifiedByUser"
          value="true"
          defaultChecked={ingredient?.verifiedByUser ?? false}
        />
        Dane sprawdzone ręcznie
      </label>
      {tags.length ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Tagi</legend>
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  defaultChecked={selectedTagIds.has(tag.id)}
                />
                {tag.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}

function IngredientConversionsForm({
  ingredientId,
  conversions,
}: {
  ingredientId: string;
  conversions: IngredientUnitConversion[];
}) {
  const rows = conversions.length
    ? conversions
    : [
        { id: "new-1", unit: "szt", gramsEquivalent: "", label: null, isDefault: false },
        { id: "new-2", unit: "lyzka", gramsEquivalent: "", label: null, isDefault: false },
        { id: "new-3", unit: "lyzeczka", gramsEquivalent: "", label: null, isDefault: false },
        { id: "new-4", unit: "szklanka", gramsEquivalent: "", label: null, isDefault: false },
      ];
  return (
    <form action={replaceIngredientUnitConversionsAction.bind(null, ingredientId)} className="space-y-3">
      <p className="text-sm font-medium">Konwersje jednostek składnika</p>
      <p className="text-xs text-muted-foreground">
        Dodaj tylko przeliczniki specyficzne dla tego składnika, np. `1 szt = 55 g`.
      </p>
      {rows.map((conversion, index) => (
        <div key={`${conversion.unit}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_1fr]">
          <select
            name="conversionUnit"
            defaultValue={conversion.unit}
            className="flex h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="szt">szt</option>
            <option value="lyzka">łyżka</option>
            <option value="lyzeczka">łyżeczka</option>
            <option value="szklanka">szklanka</option>
            <option value="opakowanie">opakowanie</option>
          </select>
          <Input
            name="conversionGrams"
            type="number"
            min="0.0001"
            step="0.0001"
            defaultValue={String(conversion.gramsEquivalent ?? "")}
            placeholder="gramów"
          />
          <Input name="conversionLabel" defaultValue={conversion.label ?? ""} placeholder="np. średnie jajko" />
        </div>
      ))}
      <Button type="submit" variant="outline" size="sm">
        Zapisz konwersje
      </Button>
    </form>
  );
}

function ProductForm({
  action,
  product,
  ingredients,
  tags,
  selectedTagIds = new Set<string>(),
  submitLabel,
}: {
  action: FormAction;
  product?: Product;
  ingredients: Ingredient[];
  tags: Tag[];
  selectedTagIds?: Set<string>;
  submitLabel: string;
}) {
  const prefix = product?.id ?? "new-product";
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-name`}>Nazwa</Label>
          <Input id={`${prefix}-name`} name="name" defaultValue={product?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-brand`}>Marka</Label>
          <Input id={`${prefix}-brand`} name="brand" defaultValue={product?.brand ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-barcode`}>Kod kreskowy</Label>
          <Input
            id={`${prefix}-barcode`}
            name="barcode"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={product?.barcode ?? ""}
            placeholder="EAN / UPC / GTIN"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-ingredient`}>Powiązany składnik</Label>
          <select
            id={`${prefix}-ingredient`}
            name="ingredientId"
            defaultValue={product?.ingredientId ?? ""}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Brak</option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-quantity`}>Wielkość opakowania</Label>
          <Input id={`${prefix}-quantity`} name="packageQuantity" type="number" min="0" step="0.01" defaultValue={product?.packageQuantity ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-unit`}>Jednostka opakowania</Label>
          <select
            id={`${prefix}-unit`}
            name="packageUnit"
            defaultValue={product?.packageUnit ?? "g"}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {SUPPORTED_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </div>
      </div>
      <NutritionFields values={product} prefix={prefix} />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="verifiedByUser"
          value="true"
          defaultChecked={product?.verifiedByUser ?? false}
        />
        Dane sprawdzone ręcznie
      </label>
      {tags.length ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Tagi</legend>
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  defaultChecked={selectedTagIds.has(tag.id)}
                />
                {tag.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}

interface IngredientsPageProps {
  searchParams: Promise<{ q?: string; category?: string; tag?: string }>;
}

export default async function IngredientsPage({ searchParams }: IngredientsPageProps) {
  const { householdId, role } = await requireActiveHouseholdOrRedirect();
  const { q = "", category = "", tag = "" } = await searchParams;
  const search = q.trim();
  const [listedIngredients, products, categories, tags, allTags, allIngredients] = await Promise.all([
    listIngredients(householdId, search || undefined, category || undefined),
    listProducts(householdId, search || undefined),
    listCategories(householdId),
    listTags(householdId, "ingredient"),
    listTags(householdId),
    listIngredients(householdId),
  ]);
  const ingredientTags = await getIngredientTags(listedIngredients.map((ingredient) => ingredient.id));
  const ingredientConversions = await getIngredientUnitConversions(
    listedIngredients.map((ingredient) => ingredient.id),
  );
  const productTagRelations = await getProductTags(products.map((product) => product.id));
  const tagIdsByIngredient = new Map<string, Set<string>>();
  for (const relation of ingredientTags) {
    const current = tagIdsByIngredient.get(relation.ingredientId) ?? new Set<string>();
    current.add(relation.tagId);
    tagIdsByIngredient.set(relation.ingredientId, current);
  }
  const conversionsByIngredient = new Map<string, IngredientUnitConversion[]>();
  for (const conversion of ingredientConversions) {
    const current = conversionsByIngredient.get(conversion.ingredientId) ?? [];
    current.push(conversion);
    conversionsByIngredient.set(conversion.ingredientId, current);
  }
  const ingredients = tag
    ? listedIngredients.filter((ingredient) => tagIdsByIngredient.get(ingredient.id)?.has(tag))
    : listedIngredients;
  const tagIdsByProduct = new Map<string, Set<string>>();
  for (const relation of productTagRelations) {
    const current = tagIdsByProduct.get(relation.productId) ?? new Set<string>();
    current.add(relation.tagId);
    tagIdsByProduct.set(relation.productId, current);
  }
  const productTagOptions = allTags.filter((tag) => tag.type === "product");
  const editable = canEdit(role);

  return (
    <DashboardShell>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Składniki i produkty</h1>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/ingredients/scan">Skanuj kod kreskowy</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/ingredients/usda">Wyszukaj składnik w USDA</Link>
            </Button>
          </div>
        ) : null}

        <form className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_12rem_12rem_auto]" method="get">
          <Input name="q" defaultValue={search} placeholder="Nazwa, marka lub kod kreskowy" className="sm:col-span-2 xl:col-span-1" />
          <select
            name="category"
            defaultValue={category}
            className="flex h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select
            name="tag"
            defaultValue={tag}
            className="flex h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Wszystkie tagi</option>
            {tags.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <Button type="submit" variant="secondary" className="w-full xl:w-auto">Szukaj</Button>
        </form>

        {!editable ? (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            Masz dostęp tylko do odczytu.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Dodaj składnik</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 rounded-lg border p-3 text-sm text-muted-foreground">
                    Dla ogólnych składników możesz użyć importu z USDA, a dla produktów sklepowych skanowania kodu kreskowego z Open Food Facts.
                  </div>
                  <IngredientForm
                    action={createIngredientAction}
                    categories={categories}
                    tags={tags}
                    submitLabel="Dodaj składnik"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Dodaj produkt</CardTitle></CardHeader>
                <CardContent>
                  <ProductForm
                    action={createProductAction}
                    ingredients={allIngredients}
                    tags={productTagOptions}
                    submitLabel="Dodaj produkt"
                  />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Kategorie i tagi</CardTitle></CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <form action={createCategoryAction} className="flex gap-2">
                    <Input name="name" placeholder="Nowa kategoria" required />
                    <Button type="submit">Dodaj</Button>
                  </form>
                  {categories.map((category) => (
                    <details key={category.id}>
                      <summary className="cursor-pointer">{category.name}</summary>
                      <form action={updateCategoryAction.bind(null, category.id)} className="mt-2 flex flex-wrap gap-2">
                        <Input name="name" defaultValue={category.name} required className="min-w-0 flex-1" />
                        <Input name="sortOrder" type="number" defaultValue={category.sortOrder} className="w-20 shrink-0" aria-label="Kolejność" />
                        <Button type="submit" size="sm">Zapisz</Button>
                        <Button formAction={deleteCategoryAction.bind(null, category.id)} type="submit" variant="ghost" size="sm">Usuń</Button>
                      </form>
                    </details>
                  ))}
                </div>
                <div className="space-y-3">
                  <form action={createTagAction} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                    <Input name="name" placeholder="Nowy tag" required />
                    <select
                      name="type"
                      defaultValue="ingredient"
                      className="flex h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="ingredient">Składnik</option>
                      <option value="product">Produkt</option>
                      <option value="recipe">Przepis</option>
                    </select>
                    <Button type="submit">Dodaj</Button>
                  </form>
                  {allTags.map((tag) => (
                    <details key={tag.id}>
                      <summary className="cursor-pointer">{tag.name} <span className="text-xs text-muted-foreground">({tag.type})</span></summary>
                      <form action={updateTagAction.bind(null, tag.id)} className="mt-2 flex flex-wrap gap-2">
                        <Input name="name" defaultValue={tag.name} required className="min-w-0 flex-1" />
                        <input type="hidden" name="type" value={tag.type} />
                        <Button type="submit" size="sm">Zapisz</Button>
                        <Button formAction={deleteTagAction.bind(null, tag.id)} type="submit" variant="ghost" size="sm">Usuń</Button>
                      </form>
                    </details>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Składniki ({ingredients.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ingredients.length === 0 ? (
              <p className="text-muted-foreground">Brak składników.</p>
            ) : (
              ingredients.map((ing) => (
                <div key={ing.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                    <p className="font-medium">{ing.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {ing.kcalPer100
                        ? `${ing.kcalPer100} kcal / ${ing.nutritionBasis === "per100ml" ? "100 ml" : "100 g"}`
                        : "Brak makro"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Źródło: {ing.dataSource}
                      {ing.verifiedByUser ? " · zweryfikowane" : ""}
                      {ing.manuallyModified ? " · chronione po ręcznej zmianie" : ""}
                    </p>
                    </div>
                    {editable ? (
                      <form action={deleteIngredientAction.bind(null, ing.id)}>
                        <Button type="submit" variant="ghost" size="sm" className="text-destructive">Usuń</Button>
                      </form>
                    ) : null}
                  </div>
                  {editable ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium">Edytuj</summary>
                      <div className="mt-3">
                        <IngredientForm
                          action={updateIngredientAction.bind(null, ing.id)}
                          ingredient={ing}
                          categories={categories}
                          tags={tags}
                          selectedTagIds={tagIdsByIngredient.get(ing.id)}
                          submitLabel="Zapisz zmiany"
                        />
                        <div className="mt-4 border-t pt-4">
                          <IngredientConversionsForm
                            ingredientId={ing.id}
                            conversions={conversionsByIngredient.get(ing.id) ?? []}
                          />
                        </div>
                      </div>
                    </details>
                  ) : null}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{prod.name}</p>
                      {prod.brand ? <p className="text-sm text-muted-foreground">{prod.brand}</p> : null}
                      <p className="text-sm text-muted-foreground">
                        {prod.kcalPer100
                          ? `${prod.kcalPer100} kcal / ${prod.nutritionBasis === "per100ml" ? "100 ml" : "100 g"}`
                          : "Brak makro"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {prod.barcode ? `Kod: ${prod.barcode} · ` : ""}
                        Źródło: {prod.dataSource}
                        {prod.verifiedByUser ? " · zweryfikowane" : ""}
                        {prod.manuallyModified ? " · chronione po ręcznej zmianie" : ""}
                      </p>
                    </div>
                    {editable ? (
                      <div className="flex flex-wrap gap-2">
                        {prod.barcode ? (
                          <Button asChild type="button" variant="outline" size="sm">
                            <Link href={`/ingredients/scan?barcode=${encodeURIComponent(prod.barcode)}&refresh=1`}>
                              Odśwież z OFF
                            </Link>
                          </Button>
                        ) : null}
                        <form action={deleteProductAction.bind(null, prod.id)}>
                          <Button type="submit" variant="ghost" size="sm" className="text-destructive">Usuń</Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                  {editable ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium">Edytuj</summary>
                      <div className="mt-3">
                        <ProductForm
                          action={updateProductAction.bind(null, prod.id)}
                          product={prod}
                          ingredients={allIngredients}
                          tags={productTagOptions}
                          selectedTagIds={tagIdsByProduct.get(prod.id)}
                          submitLabel="Zapisz zmiany"
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
