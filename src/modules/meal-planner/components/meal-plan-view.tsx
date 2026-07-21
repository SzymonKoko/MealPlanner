"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { addDays, format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MEAL_TYPE_LABELS, mealTypeEnum } from "@/lib/meal-types";
import type { MealType } from "@/db/schema/meal-planner";
import { toast } from "sonner";
import { FeedbackForm } from "@/components/shared/feedback-form";
import { formatDateISO, getWeekStart } from "@/lib/dates";
import {
  addMealPlanEntryAction,
  moveMealPlanEntryAction,
  deleteMealPlanEntryAction,
  copyPreviousWeekAction,
  splitMealPlanEntryAction,
  updateMealPlanDetailsAction,
} from "@/modules/meal-planner/actions/meal-plan-actions";
import { AddToSlotDialog, QuantityPromptDialog } from "@/modules/meal-planner/components/add-to-slot-dialog";
import { formatPlanEntryAmount } from "@/modules/meal-planner/lib/format-entry-amount";

type PlanViewMode = "day" | "week";
type SourceType = "recipe" | "ingredient" | "product";

interface PlanEntry {
  id: string;
  recipeId: string | null;
  ingredientId: string | null;
  productId: string | null;
  itemName: string;
  sourceType: SourceType;
  date: string;
  mealType: MealType;
  servings: number;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  isBatchCooking: boolean;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  editable: boolean;
}

interface Assignment {
  mealPlanEntryId: string;
  userId: string;
  displayName: string;
  share: number;
}

interface Member {
  userId: string;
  displayName: string;
}

interface PaletteItem {
  id: string;
  name: string;
  kind: SourceType;
  kcal: number | null;
  kcalLabel: string | null;
}

interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface MealPlanViewProps {
  weekStart: string;
  scope: "mine" | "household";
  currentUserId: string;
  selectedDay: string;
  view: PlanViewMode;
  entries: PlanEntry[];
  assignments: Assignment[];
  dayTotals: Record<string, DayTotals>;
  recipes: PaletteItem[];
  compositions: Array<{ id: string; name: string }>;
  ingredients: PaletteItem[];
  members: Member[];
  editable: boolean;
  initialPick?: { date: string; mealType: MealType } | null;
}

function parseDropId(id: string): { date: string; mealType: MealType } | null {
  const [date, mealType] = id.split("|");
  if (!date || !mealType) return null;
  if (!(mealTypeEnum as readonly string[]).includes(mealType)) return null;
  return { date, mealType: mealType as MealType };
}

function resolveDropTarget(
  overId: string,
  planEntries: PlanEntry[],
): { date: string; mealType: MealType } | null {
  const cell = parseDropId(overId);
  if (cell) return cell;

  if (overId.startsWith("entry:")) {
    const entry = planEntries.find((item) => item.id === overId.slice("entry:".length));
    if (entry) return { date: entry.date, mealType: entry.mealType };
  }

  return null;
}

function parseDragId(id: string):
  | { type: "entry"; entryId: string }
  | { type: "palette"; kind: SourceType; itemId: string }
  | null {
  if (id.startsWith("entry:")) {
    return { type: "entry", entryId: id.slice("entry:".length) };
  }
  const paletteMatch = id.match(/^palette:(recipe|ingredient|product):(.+)$/);
  if (paletteMatch) {
    return {
      type: "palette",
      kind: paletteMatch[1] as SourceType,
      itemId: paletteMatch[2],
    };
  }
  return null;
}

function planHref(params: { week: string; view: PlanViewMode; day?: string; scope?: "mine" | "household" }) {
  const search = new URLSearchParams({ week: params.week, view: params.view });
  if (params.day) search.set("day", params.day);
  search.set("scope", params.scope ?? "mine");
  return `/plan?${search.toString()}`;
}

export function MealPlanView({
  weekStart,
  scope,
  currentUserId,
  selectedDay,
  view,
  entries: initialEntries,
  assignments: initialAssignments,
  dayTotals,
  recipes,
  compositions,
  ingredients,
  members,
  editable,
  initialPick,
}: MealPlanViewProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [error, setError] = useState<string | null>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [kcalSort, setKcalSort] = useState<"name" | "kcal-asc" | "kcal-desc">("name");
  const [maxKcal, setMaxKcal] = useState("");
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ date: string; mealType: MealType } | null>(null);
  const [quantityPrompt, setQuantityPrompt] = useState<{
    kind: SourceType;
    itemId: string;
    date: string;
    mealType: MealType;
    itemName: string;
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  useEffect(() => {
    setEntries(initialEntries);
    setAssignments(initialAssignments);
  }, [initialAssignments, initialEntries]);

  useEffect(() => {
    if (!initialPick || !editable) return;
    setPickerTarget({ date: initialPick.date, mealType: initialPick.mealType });
    const url = new URL(window.location.href);
    url.searchParams.delete("pick");
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [editable, initialPick]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"),
  );

  function filterAndSortPalette(items: PaletteItem[]) {
    const q = paletteQuery.trim().toLowerCase();
    const max = maxKcal.trim() ? Number.parseFloat(maxKcal) : null;
    let list = items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (max != null && Number.isFinite(max) && (item.kcal == null || item.kcal > max)) return false;
      return true;
    });
    if (kcalSort === "kcal-asc") {
      list = [...list].sort((a, b) => (a.kcal ?? Number.POSITIVE_INFINITY) - (b.kcal ?? Number.POSITIVE_INFINITY));
    } else if (kcalSort === "kcal-desc") {
      list = [...list].sort((a, b) => (b.kcal ?? -1) - (a.kcal ?? -1));
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "pl"));
    }
    return list;
  }

  const filteredRecipes = useMemo(
    () => filterAndSortPalette(recipes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paletteQuery, recipes, kcalSort, maxKcal],
  );

  const filteredIngredients = useMemo(
    () => filterAndSortPalette(ingredients),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ingredients, paletteQuery, kcalSort, maxKcal],
  );

  const dayEntries = entries.filter((e) => e.date === selectedDay);

  function go(href: string) {
    const url = new URL(href, window.location.origin);
    url.searchParams.set("scope", scope);
    window.location.href = `${url.pathname}?${url.searchParams.toString()}`;
  }

  async function handleAdd(
    kind: SourceType,
    itemId: string,
    date: string,
    mealType: MealType,
    itemName: string,
    quantity?: number,
    unit?: string,
  ) {
    const formData = new FormData();
    if (kind === "recipe") formData.set("recipeId", itemId);
    if (kind === "ingredient") formData.set("ingredientId", itemId);
    if (kind === "product") formData.set("productId", itemId);
    formData.set("date", date);
    formData.set("mealType", mealType);
    formData.set("planScope", scope);
    if (kind === "recipe") {
      formData.set("servings", "1");
    } else {
      formData.set("quantity", String(quantity ?? 100));
      formData.set("unit", unit ?? "g");
      formData.set("servings", "1");
    }
    setError(null);
    try {
      await addMealPlanEntryAction(formData);
      toast.success(`Dodano „${itemName}” do planu`);
      window.location.reload();
    } catch {
      setError(`Nie udało się dodać „${itemName}”. Spróbuj ponownie.`);
      toast.error(`Nie udało się dodać „${itemName}”`);
    }
  }

  async function handleMove(entryId: string, date: string, mealType: MealType) {
    const formData = new FormData();
    formData.set("entryId", entryId);
    formData.set("date", date);
    formData.set("mealType", mealType);
    setError(null);
    try {
      await moveMealPlanEntryAction(formData);
      setEntries((current) =>
        current.map((entry) => (entry.id === entryId ? { ...entry, date, mealType } : entry)),
      );
      toast.success("Przeniesiono posiłek");
    } catch {
      setError("Nie udało się przenieść posiłku. Odśwież widok i spróbuj ponownie.");
      toast.error("Nie udało się przenieść posiłku");
      throw new Error("Meal plan move failed");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setIsDragging(true);
    const parsed = parseDragId(String(event.active.id));
    if (!parsed) {
      setActiveDragLabel(null);
      return;
    }
    if (parsed.type === "entry") {
      setActiveDragLabel(entries.find((item) => item.id === parsed.entryId)?.itemName ?? "Posiłek");
      return;
    }
    const palette = parsed.kind === "recipe" ? recipes : ingredients;
    setActiveDragLabel(
      palette.find((item) => item.id === parsed.itemId && (parsed.kind === "recipe" || item.kind === parsed.kind))
        ?.name ?? "Element",
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    setActiveDragLabel(null);
    if (!event.over || !editable) return;

    const drop = resolveDropTarget(String(event.over.id), entries);
    const drag = parseDragId(String(event.active.id));
    if (!drop || !drag) return;

    if (drag.type === "entry") {
      const entry = entries.find((item) => item.id === drag.entryId);
      if (!entry || !entry.editable || (entry.date === drop.date && entry.mealType === drop.mealType)) return;
      void handleMove(drag.entryId, drop.date, drop.mealType).catch(() => undefined);
      return;
    }

    const item =
      drag.kind === "recipe"
        ? recipes.find((r) => r.id === drag.itemId)
        : ingredients.find((i) => i.id === drag.itemId && i.kind === drag.kind);
    if (!item) return;
    if (drag.kind === "recipe") {
      void handleAdd(drag.kind, drag.itemId, drop.date, drop.mealType, item.name);
      return;
    }
    setQuantityPrompt({
      kind: drag.kind,
      itemId: drag.itemId,
      date: drop.date,
      mealType: drop.mealType,
      itemName: item.name,
    });
  }

  function handleDragCancel() {
    setIsDragging(false);
    setActiveDragLabel(null);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="inline-flex rounded-lg border p-1">
        <Button asChild size="sm" variant={scope === "mine" ? "default" : "ghost"}>
          <Link href={planHref({ week: weekStart, view, day: selectedDay, scope: "mine" })}>
          Mój plan
          </Link>
        </Button>
        <Button asChild size="sm" variant={scope === "household" ? "default" : "ghost"}>
          <Link href={planHref({ week: weekStart, view, day: selectedDay, scope: "household" })}>
          Plan domu
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={view === "day" ? "default" : "ghost"}
            onClick={() => go(planHref({ week: weekStart, view: "day", day: selectedDay, scope }))}
          >
            Dzień
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "week" ? "default" : "ghost"}
            onClick={() => go(planHref({ week: weekStart, view: "week", day: selectedDay, scope }))}
          >
            Tydzień
          </Button>
        </div>

        {view === "week" && editable ? (
          <FeedbackForm
            action={copyPreviousWeekAction}
            successMessage="Skopiowano poprzedni tydzień"
            className="flex flex-wrap gap-2"
          >
            <input
              type="hidden"
              name="sourceWeekStart"
              value={format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd")}
            />
            <input type="hidden" name="targetWeekStart" value={weekStart} />
            <Button type="submit" variant="secondary" size="sm">
              Kopiuj poprzedni tydzień
            </Button>
          </FeedbackForm>
        ) : null}
      </div>

      {view === "day" ? (
        <DayNavigation
          selectedDay={selectedDay}
          weekStart={weekStart}
          weekDays={weekDays}
          onNavigate={go}
        />
      ) : (
        <WeekNavigation weekStart={weekStart} selectedDay={selectedDay} onNavigate={go} />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {view === "week" ? (
          <WeekGrid
            weekDays={weekDays}
            entries={entries}
            dayTotals={dayTotals}
            editable={editable}
            isDragging={isDragging}
            onOpenDay={(day) => go(planHref({ week: weekStart, view: "day", day }))}
            onOpenPicker={(date, mealType) => setPickerTarget({ date, mealType })}
          />
        ) : (
          <DayDetail
            selectedDay={selectedDay}
            dayTotal={dayTotals[selectedDay]}
            entries={dayEntries}
            assignments={assignments}
            members={members}
            editable={editable}
            scope={scope}
            currentUserId={currentUserId}
            isDragging={isDragging}
            onOpenPicker={(mealType) => setPickerTarget({ date: selectedDay, mealType })}
          />
        )}

        {editable ? (
          <PlanPalette
            query={paletteQuery}
            onQueryChange={setPaletteQuery}
            kcalSort={kcalSort}
            onKcalSortChange={setKcalSort}
            maxKcal={maxKcal}
            onMaxKcalChange={setMaxKcal}
            recipes={filteredRecipes}
            ingredients={filteredIngredients}
          />
        ) : null}

        {editable && pickerTarget ? (
          <AddToSlotDialog
            open={Boolean(pickerTarget)}
            onOpenChange={(open) => {
              if (!open) setPickerTarget(null);
            }}
            weekStart={weekStart}
            date={pickerTarget.date}
            mealType={pickerTarget.mealType}
            scope={scope}
            recipes={recipes}
            compositions={compositions}
            ingredients={ingredients}
            onPick={async (kind, itemId, itemName, quantity, unit) => {
              await handleAdd(kind, itemId, pickerTarget.date, pickerTarget.mealType, itemName, quantity, unit);
            }}
          />
        ) : null}

        {editable && quantityPrompt ? (
          <QuantityPromptDialog
            open={Boolean(quantityPrompt)}
            onOpenChange={(open) => {
              if (!open) setQuantityPrompt(null);
            }}
            itemName={quantityPrompt.itemName}
            onConfirm={async (quantity, unit) => {
              const prompt = quantityPrompt;
              setQuantityPrompt(null);
              await handleAdd(
                prompt.kind,
                prompt.itemId,
                prompt.date,
                prompt.mealType,
                prompt.itemName,
                quantity,
                unit,
              );
            }}
          />
        ) : null}

        <DragOverlay>
          {activeDragLabel ? (
            <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
              {activeDragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function DayNavigation({
  selectedDay,
  weekStart,
  weekDays,
  onNavigate,
}: {
  selectedDay: string;
  weekStart: string;
  weekDays: string[];
  onNavigate: (href: string) => void;
}) {
  const prevDay = format(addDays(parseISO(selectedDay), -1), "yyyy-MM-dd");
  const nextDay = format(addDays(parseISO(selectedDay), 1), "yyyy-MM-dd");

  function weekOf(day: string) {
    return formatDateISO(getWeekStart(parseISO(day)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onNavigate(planHref({ week: weekOf(prevDay), view: "day", day: prevDay }))
          }
        >
          Poprzedni
        </Button>
        <h2 className="text-center font-semibold capitalize">
          {format(parseISO(selectedDay), "EEEE, d MMMM yyyy", { locale: pl })}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onNavigate(planHref({ week: weekOf(nextDay), view: "day", day: nextDay }))
          }
        >
          Następny
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <Button
            key={day}
            size="sm"
            variant={selectedDay === day ? "default" : "outline"}
            className="h-auto min-h-11 min-w-0 flex-col gap-0 px-1 py-1 leading-tight"
            onClick={() => onNavigate(planHref({ week: weekStart, view: "day", day }))}
          >
            <span>{format(parseISO(day), "EEE", { locale: pl })}</span>
            <span>{format(parseISO(day), "d", { locale: pl })}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function WeekNavigation({
  weekStart,
  selectedDay,
  onNavigate,
}: {
  weekStart: string;
  selectedDay: string;
  onNavigate: (href: string) => void;
}) {
  const prev = format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd");
  const next = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onNavigate(planHref({ week: prev, view: "week", day: selectedDay }))}
      >
        Poprzedni
      </Button>
      <span className="font-medium">
        {format(parseISO(weekStart), "d MMM", { locale: pl })} –{" "}
        {format(addDays(parseISO(weekStart), 6), "d MMM yyyy", { locale: pl })}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onNavigate(planHref({ week: next, view: "week", day: selectedDay }))}
      >
        Następny
      </Button>
    </div>
  );
}

function DayMacros({ totals }: { totals?: DayTotals }) {
  if (!totals) return null;
  return (
    <p className="text-[11px] leading-tight text-muted-foreground tabular-nums">
      {Math.round(totals.kcal)} kcal
      <br />
      B {Math.round(totals.protein)} · W {Math.round(totals.carbs)} · T {Math.round(totals.fat)}
    </p>
  );
}

function sumMealNutrition(entries: Pick<PlanEntry, "kcal" | "protein" | "carbs" | "fat">[]) {
  return entries.reduce(
    (acc, entry) => ({
      kcal: acc.kcal + entry.kcal,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function MealSlotMacros({ entries }: { entries: PlanEntry[] }) {
  if (!entries.length) return null;
  const totals = sumMealNutrition(entries);
  if (totals.kcal <= 0) return null;
  return (
    <p className="text-xs tabular-nums text-muted-foreground">
      {Math.round(totals.kcal)} kcal · B {Math.round(totals.protein)} · W {Math.round(totals.carbs)} · T{" "}
      {Math.round(totals.fat)}
    </p>
  );
}

function WeekGrid({
  weekDays,
  entries,
  dayTotals,
  editable,
  isDragging,
  onOpenDay,
  onOpenPicker,
}: {
  weekDays: string[];
  entries: PlanEntry[];
  dayTotals: Record<string, DayTotals>;
  editable: boolean;
  isDragging: boolean;
  onOpenDay: (day: string) => void;
  onOpenPicker: (date: string, mealType: MealType) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid min-w-[48rem] items-start gap-2 md:min-w-[74rem]"
        style={{ gridTemplateColumns: "5.5rem repeat(7, minmax(9.5rem, 1fr))" }}
      >
        <div />
        {weekDays.map((day) => (
          <button
            key={day}
            type="button"
            className="space-y-1 rounded-md px-1 py-1 text-center hover:bg-accent"
            onClick={() => onOpenDay(day)}
          >
            <span className="block text-sm font-medium">
              {format(parseISO(day), "EEE d", { locale: pl })}
            </span>
            <DayMacros totals={dayTotals[day]} />
          </button>
        ))}
        {mealTypeEnum.map((mealType) => (
          <Fragment key={mealType}>
            <div className="pt-2 text-xs font-medium leading-snug text-muted-foreground">
              {MEAL_TYPE_LABELS[mealType]}
            </div>
            {weekDays.map((day) => {
              const cellEntries = entries.filter((e) => e.date === day && e.mealType === mealType);
              return (
                <DroppablePlanCell
                  key={`${day}-${mealType}`}
                  id={`${day}|${mealType}`}
                  isDragging={isDragging}
                  empty={!cellEntries.length}
                  compact
                  onAddClick={editable ? () => onOpenPicker(day, mealType) : undefined}
                >
                  {cellEntries.map((entry) => (
                    <CompactEntryChip key={entry.id} entry={entry} editable={editable} />
                  ))}
                </DroppablePlanCell>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function DayDetail({
  selectedDay,
  dayTotal,
  entries,
  assignments,
  members,
  editable,
  scope,
  currentUserId,
  isDragging,
  onOpenPicker,
}: {
  selectedDay: string;
  dayTotal?: DayTotals;
  entries: PlanEntry[];
  assignments: Assignment[];
  members: Member[];
  editable: boolean;
  scope: "mine" | "household";
  currentUserId: string;
  isDragging: boolean;
  onOpenPicker: (mealType: MealType) => void;
}) {
  return (
    <div className="space-y-3">
      {dayTotal ? (
        <Card>
          <CardContent className="flex flex-wrap gap-x-4 gap-y-1 p-3 text-sm">
            <span className="font-medium">{Math.round(dayTotal.kcal)} kcal</span>
            <span className="text-muted-foreground">Białko {Math.round(dayTotal.protein)} g</span>
            <span className="text-muted-foreground">Węgle {Math.round(dayTotal.carbs)} g</span>
            <span className="text-muted-foreground">Tłuszcz {Math.round(dayTotal.fat)} g</span>
            <span className="text-muted-foreground">Błonnik {Math.round(dayTotal.fiber)} g</span>
          </CardContent>
        </Card>
      ) : null}
      {mealTypeEnum.map((mealType) => {
        const typeEntries = entries.filter((e) => e.mealType === mealType);
        return (
          <DroppablePlanCell
            key={mealType}
            id={`${selectedDay}|${mealType}`}
            isDragging={isDragging}
            empty={!typeEntries.length}
            className="min-h-28"
            onAddClick={editable ? () => onOpenPicker(mealType) : undefined}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{MEAL_TYPE_LABELS[mealType]}</p>
                <MealSlotMacros entries={typeEntries} />
              </div>
              {editable ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onOpenPicker(mealType)}>
                  + Dodaj
                </Button>
              ) : null}
            </div>
            <div className="space-y-3">
              {typeEntries.map((entry) => (
                <DetailedEntryCard
                  key={entry.id}
                  entry={entry}
                  assignments={assignments.filter((a) => a.mealPlanEntryId === entry.id)}
                  members={members}
                  editable={editable && (
                    scope === "household" ||
                    (assignments.filter((a) => a.mealPlanEntryId === entry.id).length === 1 &&
                      assignments.some((a) => a.mealPlanEntryId === entry.id && a.userId === currentUserId && a.share === 1))
                  )}
                  scope={scope}
                />
              ))}
            </div>
          </DroppablePlanCell>
        );
      })}
    </div>
  );
}

function CompactEntryChip({ entry, editable }: { entry: PlanEntry; editable: boolean }) {
  const canEditEntry = editable && entry.editable;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    disabled: !canEditEntry,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-1 rounded border bg-accent/40 px-2 py-1.5 text-xs leading-snug ${
        canEditEntry ? "cursor-grab touch-none active:cursor-grabbing" : ""
      }`}
      title={entry.itemName}
      {...(canEditEntry ? listeners : {})}
      {...(canEditEntry ? attributes : {})}
    >
      <span className="min-w-0 flex-1 break-words font-medium">{entry.itemName}</span>
      {canEditEntry ? (
        <FeedbackForm
          action={deleteMealPlanEntryAction.bind(null, entry.id)}
          successMessage="Usunięto z planu"
          className="shrink-0"
        >
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
            aria-label={`Usuń ${entry.itemName}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            ×
          </Button>
        </FeedbackForm>
      ) : null}
    </div>
  );
}

function ShareSplitEditor({
  entry,
  assignments,
  members,
}: {
  entry: PlanEntry;
  assignments: Assignment[];
  members: Member[];
}) {
  const [selected, setSelected] = useState(
    () => new Set(assignments.map(({ userId }) => userId)),
  );
  const [percentages, setPercentages] = useState<Record<string, number>>(
    () => Object.fromEntries(assignments.map(({ userId, share }) => [userId, share * 100])),
  );
  const [saving, setSaving] = useState(false);
  const total = [...selected].reduce((sum, userId) => sum + (percentages[userId] ?? 0), 0);

  async function saveEqual() {
    setSaving(true);
    try {
      await splitMealPlanEntryAction({ entryId: entry.id, mode: "equal", userIds: [...selected] });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveCustom() {
    setSaving(true);
    try {
      await splitMealPlanEntryAction({
        entryId: entry.id,
        mode: "percentage",
        allocations: [...selected].map((userId) => ({
          userId,
          percentage: percentages[userId] ?? 0,
        })),
      });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Podział posiłku</p>
      {members.map((member) => {
        const checked = selected.has(member.userId);
        const percentage = percentages[member.userId] ?? 0;
        return (
          <div key={member.userId} className="grid grid-cols-[1fr_5rem] items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked} onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(member.userId);
                else next.delete(member.userId);
                setSelected(next);
              }} />
              {member.displayName}
            </label>
            <div>
              <Input type="number" min="0.01" max="100" step="0.01" value={percentage}
                disabled={!checked}
                aria-label={`Procent: ${member.displayName}`}
                onChange={(event) => setPercentages((current) => ({
                  ...current,
                  [member.userId]: Number(event.target.value),
                }))} />
              {checked ? (
                <span className="text-xs text-muted-foreground">
                  {formatPlanEntryAmount({
                    recipeId: entry.recipeId,
                    servings: entry.servings * percentage / 100,
                    quantity: entry.quantity == null ? null : entry.quantity * percentage / 100,
                    unit: entry.unit,
                  })}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      <p className={Math.abs(total - 100) < 0.001 ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
        Suma: {Math.round(total * 100) / 100}%
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={saving || selected.size === 0} onClick={saveEqual}>
          Podziel równo
        </Button>
        <Button type="button" size="sm" variant="outline"
          disabled={saving || selected.size === 0 || Math.abs(total - 100) >= 0.001}
          onClick={saveCustom}>
          Zapisz własny podział
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await splitMealPlanEntryAction({ entryId: entry.id, mode: "clear" });
              window.location.reload();
            } finally {
              setSaving(false);
            }
          }}>
          Wyczyść
        </Button>
      </div>
    </div>
  );
}

function DetailedEntryCard({
  entry,
  assignments,
  members,
  editable,
  scope,
}: {
  entry: PlanEntry;
  assignments: Assignment[];
  members: Member[];
  editable: boolean;
  scope: "mine" | "household";
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    disabled: !editable,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-accent/20 p-3 ${editable ? "touch-none" : ""}`}
    >
      <div
        className={`flex items-start justify-between gap-2 ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
        {...(editable ? listeners : {})}
        {...(editable ? attributes : {})}
      >
        <p className="text-base font-semibold">{entry.itemName}</p>
        <div className="flex shrink-0 gap-1" onPointerDown={(event) => event.stopPropagation()}>
          {editable ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
              {editing ? "Zwiń" : "Edytuj"}
            </Button>
          ) : null}
          {editable ? (
            <FeedbackForm
              action={deleteMealPlanEntryAction.bind(null, entry.id)}
              successMessage="Usunięto posiłek z planu"
            >
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                Usuń
              </Button>
            </FeedbackForm>
          ) : null}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{entry.sourceType === "recipe" ? "Przepis" : "Składnik"}</span>
        <span>
          {formatPlanEntryAmount({
            sourceType: entry.sourceType,
            recipeId: entry.recipeId,
            servings: entry.servings,
            quantity: entry.quantity,
            unit: entry.unit,
          })}
        </span>
        {entry.isBatchCooking ? <span>Gotowanie na kilka dni</span> : null}
      </div>

      {entry.kcal > 0 ? (
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {Math.round(entry.kcal)} kcal · B {Math.round(entry.protein)} · W {Math.round(entry.carbs)} · T {Math.round(entry.fat)}
        </p>
      ) : null}

      {entry.notes ? <p className="mt-2 text-sm">{entry.notes}</p> : null}

      {scope === "household" && assignments.length ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Porcje domowników</p>
          {assignments.map((a) => (
            <p key={a.userId} className="text-sm">
              {a.displayName}: {Math.round(a.share * 100)}% ({formatPlanEntryAmount({
                recipeId: entry.recipeId,
                servings: entry.servings * a.share,
                quantity: entry.quantity == null ? null : entry.quantity * a.share,
                unit: entry.unit,
              })})
            </p>
          ))}
        </div>
      ) : null}

      {scope === "household" && assignments.length === 0 ? (
        <p className="mt-2 text-sm font-medium text-amber-700">Nie rozdzielono porcji</p>
      ) : null}
      {scope === "mine" && !editable ? (
        <a className="mt-2 inline-block text-sm font-medium text-primary underline" href="/plan?scope=household">
          Edytuj współdzielony posiłek w Planie domu
        </a>
      ) : null}

      {editable && editing ? (
        <div className="mt-3 space-y-3 border-t pt-3">
          {scope === "household" ? (
            <ShareSplitEditor entry={entry} assignments={assignments} members={members} />
          ) : null}

          <FeedbackForm
            action={updateMealPlanDetailsAction}
            successMessage="Zapisano szczegóły posiłku"
            errorMessage="Nie udało się zapisać szczegółów"
            onSuccess={() => setEditing(false)}
            className="space-y-2"
          >
            <input type="hidden" name="entryId" value={entry.id} />
            {entry.sourceType === "recipe" ? (
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Porcje</span>
                <input
                  className="h-11 w-full rounded-lg border bg-background px-2 text-base"
                  type="number"
                  min="1"
                  name="servings"
                  defaultValue={entry.servings}
                />
              </label>
            ) : (
              <>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Gramatura (g)</span>
                  <input
                    className="h-11 w-full rounded-lg border bg-background px-2 text-base"
                    type="number"
                    min="0.1"
                    step="any"
                    name="quantity"
                    defaultValue={entry.quantity ?? entry.servings * 100}
                  />
                </label>
                <input type="hidden" name="unit" value={entry.unit ?? "g"} />
              </>
            )}
            <textarea
              className="min-h-20 w-full rounded-lg border bg-background p-2 text-base"
              name="notes"
              defaultValue={entry.notes ?? ""}
              placeholder="Notatka"
            />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="isBatchCooking" value="true" defaultChecked={entry.isBatchCooking} />
              Gotowanie na kilka dni
            </label>
            <Button type="submit" size="sm">
              Zapisz
            </Button>
          </FeedbackForm>
        </div>
      ) : null}
    </div>
  );
}

function PlanPalette({
  query,
  onQueryChange,
  kcalSort,
  onKcalSortChange,
  maxKcal,
  onMaxKcalChange,
  recipes,
  ingredients,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  kcalSort: "name" | "kcal-asc" | "kcal-desc";
  onKcalSortChange: (value: "name" | "kcal-asc" | "kcal-desc") => void;
  maxKcal: string;
  onMaxKcalChange: (value: string) => void;
  recipes: PaletteItem[];
  ingredients: PaletteItem[];
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="font-semibold">Przepisy i składniki</h2>
          <p className="text-sm text-muted-foreground">Przeciągnij na slot w planerze.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_8rem]">
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Szukaj…"
            aria-label="Szukaj w palecie"
          />
          <select
            value={kcalSort}
            onChange={(event) => onKcalSortChange(event.target.value as "name" | "kcal-asc" | "kcal-desc")}
            className="h-11 rounded-lg border bg-background px-2 text-sm"
            aria-label="Sortowanie"
          >
            <option value="name">Sortuj: nazwa</option>
            <option value="kcal-asc">Sortuj: kcal ↑</option>
            <option value="kcal-desc">Sortuj: kcal ↓</option>
          </select>
          <Input
            value={maxKcal}
            onChange={(event) => onMaxKcalChange(event.target.value)}
            type="number"
            min="0"
            placeholder="Max kcal"
            aria-label="Filtr max kcal"
          />
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Przepisy</p>
          <div className="flex flex-wrap gap-2">
            {recipes.length ? (
              recipes.map((item) => <PaletteChip key={`recipe-${item.id}`} item={item} />)
            ) : (
              <p className="text-sm text-muted-foreground">Brak przepisów.</p>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Składniki</p>
          <div className="flex flex-wrap gap-2">
            {ingredients.length ? (
              ingredients.map((item) => <PaletteChip key={`${item.kind}-${item.id}`} item={item} />)
            ) : (
              <p className="text-sm text-muted-foreground">Brak składników.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PaletteChip({ item }: { item: PaletteItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${item.kind}:${item.id}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className="cursor-grab touch-none rounded-md border bg-background px-3 py-2 text-left text-sm shadow-sm active:cursor-grabbing"
      {...listeners}
      {...attributes}
    >
      <span className="font-medium">{item.name}</span>
      <span className="mt-0.5 block text-[11px] text-muted-foreground">
        {item.kind === "recipe" ? "Przepis" : "Składnik"}
        {item.kcalLabel ? ` · ${item.kcalLabel} kcal` : ""}
      </span>
    </button>
  );
}

function DroppablePlanCell({
  id,
  children,
  isDragging,
  empty,
  compact = false,
  className = "",
  onAddClick,
}: {
  id: string;
  children: React.ReactNode;
  isDragging: boolean;
  empty: boolean;
  compact?: boolean;
  className?: string;
  onAddClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      className={`h-auto transition-colors ${compact ? "min-h-16" : "min-h-20"} ${
        isOver ? "border-primary bg-accent" : ""
      } ${className}`}
    >
      <CardContent className={`flex h-full flex-col ${compact ? "gap-1.5 p-2" : "gap-2 p-3"}`}>
        {children}
        {empty && !onAddClick ? (
          <p
            className={`mt-auto text-center ${compact ? "py-2 text-[10px]" : "py-3 text-xs"} ${
              isDragging ? "text-primary" : "text-muted-foreground/70"
            }`}
          >
            {isDragging ? "Upuść" : "—"}
          </p>
        ) : null}
        {onAddClick ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`mt-auto w-full ${compact ? "h-7 text-[11px]" : "h-9 text-xs"} text-muted-foreground`}
            onClick={onAddClick}
          >
            {isDragging ? "Upuść tutaj" : "+ Dodaj"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
