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
  createCatalogItemAction,
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

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id} className="leading-tight">
        {label}
      </Label>
      {children}
    </div>
  );
}

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
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Makro (na {basisLabel})</legend>
      <Field id={`${prefix}-nutritionBasis`} label="Podstawa">
        <select
          id={`${prefix}-nutritionBasis`}
          name="nutritionBasis"
          defaultValue={values?.nutritionBasis ?? "per100g"}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="per100g">na 100 g</option>
          <option value="per100ml">na 100 ml</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
        {fields.map(([name, label]) => (
          <Field key={name} id={`${prefix}-${name}`} label={label}>
            <Input
              id={`${prefix}-${name}`}
              name={name}
              type="number"
              min="0"
              step="0.0001"
              inputMode="decimal"
              className="h-10"
              defaultValue={values?.[name] ?? ""}
            />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

function CatalogItemForm({
  action,
  item,
  categories,
  tags,
  selectedTagIds = new Set<string>(),
  submitLabel,
  showStoreFields = true,
}: {
  action: FormAction;
  item?: Ingredient | Product;
  categories: Category[];
  tags: Tag[];
  selectedTagIds?: Set<string>;
  submitLabel: string;
  showStoreFields?: boolean;
}) {
  const prefix = item?.id ?? "new-item";
  const asIngredient = item && "baseUnit" in item ? (item as Ingredient) : undefined;
  const asProduct = item && "barcode" in item ? (item as Product) : undefined;

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${prefix}-name`} label="Nazwa">
          <Input id={`${prefix}-name`} name="name" className="h-10" defaultValue={item?.name} required />
        </Field>
        {!asProduct ? (
          <Field id={`${prefix}-category`} label="Kategoria">
            <select
              id={`${prefix}-category`}
              name="categoryId"
              defaultValue={asIngredient?.categoryId ?? ""}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Bez kategorii</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {!asProduct ? (
          <Field id={`${prefix}-unit`} label="Jednostka">
            <select
              id={`${prefix}-unit`}
              name="baseUnit"
              defaultValue={asIngredient?.baseUnit ?? "g"}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {SUPPORTED_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {!asProduct ? (
          <Field id={`${prefix}-description`} label="Opis">
            <Input
              id={`${prefix}-description`}
              name="description"
              className="h-10"
              defaultValue={asIngredient?.description ?? ""}
            />
          </Field>
        ) : null}
      </div>

      {showStoreFields ? (
        <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Opcjonalnie: marka / kod kreskowy. Jeśli podasz kod, pozycja zapisze się jako produkt sklepowy.
          </p>
          <Field id={`${prefix}-brand`} label="Marka">
            <Input id={`${prefix}-brand`} name="brand" className="h-10" defaultValue={asProduct?.brand ?? ""} />
          </Field>
          <Field id={`${prefix}-barcode`} label="Kod kreskowy">
            <Input
              id={`${prefix}-barcode`}
              name="barcode"
              inputMode="numeric"
              autoComplete="off"
              className="h-10"
              defaultValue={asProduct?.barcode ?? ""}
              placeholder="EAN / UPC / GTIN"
            />
          </Field>
          <Field id={`${prefix}-quantity`} label="Opakowanie">
            <Input
              id={`${prefix}-quantity`}
              name="packageQuantity"
              type="number"
              min="0"
              step="0.01"
              className="h-10"
              defaultValue={asProduct?.packageQuantity ?? ""}
            />
          </Field>
          <Field id={`${prefix}-package-unit`} label="Jednostka opakowania">
            <select
              id={`${prefix}-package-unit`}
              name="packageUnit"
              defaultValue={asProduct?.packageUnit ?? "g"}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {SUPPORTED_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <NutritionFields values={item} prefix={prefix} />

      {!asProduct ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${prefix}-density`} label="Gęstość (g/ml)">
            <Input
              id={`${prefix}-density`}
              name="densityGramsPerMl"
              type="number"
              min="0.001"
              step="0.001"
              className="h-10"
              defaultValue={asIngredient?.densityGramsPerMl ?? ""}
            />
          </Field>
          <Field id={`${prefix}-allergens`} label="Alergeny">
            <Input
              id={`${prefix}-allergens`}
              name="allergens"
              className="h-10"
              defaultValue={asIngredient?.allergens ?? ""}
              placeholder="np. gluten, orzechy"
            />
          </Field>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="verifiedByUser"
          value="true"
          defaultChecked={item?.verifiedByUser ?? false}
        />
        Dane sprawdzone ręcznie
      </label>

      {tags.length ? (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Tagi</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-1.5 text-sm">
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

      <Button type="submit" className="w-full sm:w-auto">
        {submitLabel}
      </Button>
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
    <form action={replaceIngredientUnitConversionsAction.bind(null, ingredientId)} className="space-y-2">
      <p className="text-sm font-medium">Konwersje jednostek</p>
      <p className="text-xs text-muted-foreground">np. 1 szt = 55 g — tylko dla tej pozycji</p>
      {rows.map((conversion, index) => (
        <div key={`${conversion.unit}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_1fr]">
          <select
            name="conversionUnit"
            defaultValue={conversion.unit}
            className="flex h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
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
            className="h-10"
            defaultValue={String(conversion.gramsEquivalent ?? "")}
            placeholder="gramów"
          />
          <Input
            name="conversionLabel"
            className="h-10"
            defaultValue={conversion.label ?? ""}
            placeholder="np. średnie jajko"
          />
        </div>
      ))}
      <Button type="submit" variant="outline" size="sm">
        Zapisz konwersje
      </Button>
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
  const [listedIngredients, products, categories, tags, allTags] = await Promise.all([
    listIngredients(householdId, search || undefined, category || undefined),
    listProducts(householdId, search || undefined),
    listCategories(householdId),
    listTags(householdId, "ingredient"),
    listTags(householdId),
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
  const filteredIngredients = tag
    ? listedIngredients.filter((ingredient) => tagIdsByIngredient.get(ingredient.id)?.has(tag))
    : listedIngredients;
  const tagIdsByProduct = new Map<string, Set<string>>();
  for (const relation of productTagRelations) {
    const current = tagIdsByProduct.get(relation.productId) ?? new Set<string>();
    current.add(relation.tagId);
    tagIdsByProduct.set(relation.productId, current);
  }
  const productTagOptions = allTags.filter((entry) => entry.type === "product" || entry.type === "ingredient");
  const editable = canEdit(role);

  const catalog = [
    ...filteredIngredients.map((entry) => ({
      kind: "ingredient" as const,
      id: entry.id,
      name: entry.name,
      sortKey: entry.name.toLocaleLowerCase("pl"),
      entry,
    })),
    ...products.map((entry) => ({
      kind: "product" as const,
      id: entry.id,
      name: entry.name,
      sortKey: entry.name.toLocaleLowerCase("pl"),
      entry,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey, "pl"));

  return (
    <DashboardShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Składniki</h1>
            <p className="text-sm text-muted-foreground">
              Jedna lista pozycji do przepisów — z kodem lub bez.
            </p>
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/ingredients/scan">Skanuj kod</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/ingredients/usda">USDA</Link>
              </Button>
            </div>
          ) : null}
        </div>

        <form
          className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_11rem_11rem_auto]"
          method="get"
        >
          <Input name="q" defaultValue={search} placeholder="Szukaj nazwy, marki lub kodu" className="h-10" />
          <select
            name="category"
            defaultValue={category}
            className="flex h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Kategorie</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            name="tag"
            defaultValue={tag}
            className="flex h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Tagi</option>
            {tags.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" className="h-10">
            Szukaj
          </Button>
        </form>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {editable ? (
            <aside className="order-2 space-y-4 lg:order-1 lg:sticky lg:top-0 lg:self-start">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Dodaj</CardTitle>
                </CardHeader>
                <CardContent>
                  <CatalogItemForm
                    action={createCatalogItemAction}
                    categories={categories}
                    tags={[]}
                    submitLabel="Zapisz"
                    showStoreFields
                  />
                </CardContent>
              </Card>

              <details className="rounded-lg border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Kategorie i tagi</summary>
                <div className="space-y-4 border-t px-4 py-3">
                  <div className="space-y-2">
                    <form action={createCategoryAction} className="flex gap-2">
                      <Input name="name" placeholder="Nowa kategoria" required className="h-10" />
                      <Button type="submit" size="sm">
                        Dodaj
                      </Button>
                    </form>
                    {categories.map((cat) => (
                      <details key={cat.id}>
                        <summary className="cursor-pointer text-sm">{cat.name}</summary>
                        <form
                          action={updateCategoryAction.bind(null, cat.id)}
                          className="mt-2 flex flex-wrap gap-2"
                        >
                          <Input name="name" defaultValue={cat.name} required className="h-10 min-w-0 flex-1" />
                          <Input
                            name="sortOrder"
                            type="number"
                            defaultValue={cat.sortOrder}
                            className="h-10 w-20 shrink-0"
                            aria-label="Kolejność"
                          />
                          <Button type="submit" size="sm">
                            Zapisz
                          </Button>
                          <Button
                            formAction={deleteCategoryAction.bind(null, cat.id)}
                            type="submit"
                            variant="ghost"
                            size="sm"
                          >
                            Usuń
                          </Button>
                        </form>
                      </details>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <form action={createTagAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input name="name" placeholder="Nowy tag" required className="h-10" />
                      <input type="hidden" name="type" value="ingredient" />
                      <Button type="submit" size="sm">
                        Dodaj
                      </Button>
                    </form>
                    {allTags
                      .filter((entry) => entry.type === "ingredient")
                      .map((tagEntry) => (
                        <details key={tagEntry.id}>
                          <summary className="cursor-pointer text-sm">{tagEntry.name}</summary>
                          <form
                            action={updateTagAction.bind(null, tagEntry.id)}
                            className="mt-2 flex flex-wrap gap-2"
                          >
                            <Input
                              name="name"
                              defaultValue={tagEntry.name}
                              required
                              className="h-10 min-w-0 flex-1"
                            />
                            <input type="hidden" name="type" value={tagEntry.type} />
                            <Button type="submit" size="sm">
                              Zapisz
                            </Button>
                            <Button
                              formAction={deleteTagAction.bind(null, tagEntry.id)}
                              type="submit"
                              variant="ghost"
                              size="sm"
                            >
                              Usuń
                            </Button>
                          </form>
                        </details>
                      ))}
                  </div>
                </div>
              </details>
            </aside>
          ) : (
            <p className="rounded-lg border p-3 text-sm text-muted-foreground lg:col-span-1">
              Masz dostęp tylko do odczytu.
            </p>
          )}

          <Card className="order-1 lg:order-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Lista ({catalog.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {catalog.length === 0 ? (
                <p className="text-muted-foreground">Brak pozycji. Dodaj pierwszą z lewej lub zeskanuj kod.</p>
              ) : (
                catalog.map((item) => {
                  if (item.kind === "ingredient") {
                    const ing = item.entry;
                    return (
                      <div key={`i-${ing.id}`} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{ing.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {ing.kcalPer100
                                ? `${ing.kcalPer100} kcal / ${ing.nutritionBasis === "per100ml" ? "100 ml" : "100 g"}`
                                : "Brak makro"}
                              {ing.dataSource !== "manual" ? ` · ${ing.dataSource}` : ""}
                            </p>
                          </div>
                          {editable ? (
                            <form action={deleteIngredientAction.bind(null, ing.id)}>
                              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                                Usuń
                              </Button>
                            </form>
                          ) : null}
                        </div>
                        {editable ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium">Edytuj</summary>
                            <div className="mt-3 space-y-4">
                              <CatalogItemForm
                                action={updateIngredientAction.bind(null, ing.id)}
                                item={ing}
                                categories={categories}
                                tags={tags}
                                selectedTagIds={tagIdsByIngredient.get(ing.id)}
                                submitLabel="Zapisz"
                                showStoreFields={false}
                              />
                              <div className="border-t pt-3">
                                <IngredientConversionsForm
                                  ingredientId={ing.id}
                                  conversions={conversionsByIngredient.get(ing.id) ?? []}
                                />
                              </div>
                            </div>
                          </details>
                        ) : null}
                      </div>
                    );
                  }

                  const prod = item.entry;
                  return (
                    <div key={`p-${prod.id}`} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {prod.name}
                            {prod.brand ? (
                              <span className="font-normal text-muted-foreground"> · {prod.brand}</span>
                            ) : null}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {prod.kcalPer100
                              ? `${prod.kcalPer100} kcal / ${prod.nutritionBasis === "per100ml" ? "100 ml" : "100 g"}`
                              : "Brak makro"}
                            {prod.barcode ? ` · ${prod.barcode}` : ""}
                          </p>
                        </div>
                        {editable ? (
                          <div className="flex shrink-0 flex-wrap gap-1">
                            {prod.barcode ? (
                              <Button asChild type="button" variant="outline" size="sm">
                                <Link
                                  href={`/ingredients/scan?barcode=${encodeURIComponent(prod.barcode)}&refresh=1`}
                                >
                                  OFF
                                </Link>
                              </Button>
                            ) : null}
                            <form action={deleteProductAction.bind(null, prod.id)}>
                              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                                Usuń
                              </Button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                      {editable ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium">Edytuj</summary>
                          <div className="mt-3">
                            <CatalogItemForm
                              action={updateProductAction.bind(null, prod.id)}
                              item={prod}
                              categories={categories}
                              tags={productTagOptions}
                              selectedTagIds={tagIdsByProduct.get(prod.id)}
                              submitLabel="Zapisz"
                              showStoreFields
                            />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
