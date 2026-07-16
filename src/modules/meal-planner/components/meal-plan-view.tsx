"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
  assignPortionsAction,
  updateMealPlanDetailsAction,
} from "@/modules/meal-planner/actions/meal-plan-actions";

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
  notes: string | null;
  status: string;
  isBatchCooking: boolean;
}

interface Assignment {
  mealPlanEntryId: string;
  userId: string;
  displayName: string;
  servings: number;
}

interface Member {
  userId: string;
  displayName: string;
}

interface PaletteItem {
  id: string;
  name: string;
  kind: SourceType;
}

interface MealPlanViewProps {
  weekStart: string;
  selectedDay: string;
  view: PlanViewMode;
  entries: PlanEntry[];
  assignments: Assignment[];
  recipes: PaletteItem[];
  ingredients: PaletteItem[];
  members: Member[];
  editable: boolean;
}

function parseDropId(id: string): { date: string; mealType: MealType } | null {
  const [date, mealType] = id.split("|");
  if (!date || !mealType) return null;
  if (!(mealTypeEnum as readonly string[]).includes(mealType)) return null;
  return { date, mealType: mealType as MealType };
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

function planHref(params: { week: string; view: PlanViewMode; day?: string }) {
  const search = new URLSearchParams({ week: params.week, view: params.view });
  if (params.day) search.set("day", params.day);
  return `/plan?${search.toString()}`;
}

export function MealPlanView({
  weekStart,
  selectedDay,
  view,
  entries: initialEntries,
  assignments: initialAssignments,
  recipes,
  ingredients,
  members,
  editable,
}: MealPlanViewProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [error, setError] = useState<string | null>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setEntries(initialEntries);
    setAssignments(initialAssignments);
  }, [initialAssignments, initialEntries]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"),
  );

  const filteredRecipes = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((item) => item.name.toLowerCase().includes(q));
  }, [paletteQuery, recipes]);

  const filteredIngredients = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((item) => item.name.toLowerCase().includes(q));
  }, [ingredients, paletteQuery]);

  const dayEntries = entries.filter((e) => e.date === selectedDay);

  function go(href: string) {
    window.location.href = href;
  }

  async function handleAdd(
    kind: SourceType,
    itemId: string,
    date: string,
    mealType: MealType,
    itemName: string,
  ) {
    const formData = new FormData();
    if (kind === "recipe") formData.set("recipeId", itemId);
    if (kind === "ingredient") formData.set("ingredientId", itemId);
    if (kind === "product") formData.set("productId", itemId);
    formData.set("date", date);
    formData.set("mealType", mealType);
    formData.set("servings", "1");
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

    const drop = parseDropId(String(event.over.id));
    const drag = parseDragId(String(event.active.id));
    if (!drop || !drag) return;

    if (drag.type === "entry") {
      const entry = entries.find((item) => item.id === drag.entryId);
      if (!entry || (entry.date === drop.date && entry.mealType === drop.mealType)) return;
      void handleMove(drag.entryId, drop.date, drop.mealType).catch(() => undefined);
      return;
    }

    const item =
      drag.kind === "recipe"
        ? recipes.find((r) => r.id === drag.itemId)
        : ingredients.find((i) => i.id === drag.itemId && i.kind === drag.kind);
    if (!item) return;
    void handleAdd(drag.kind, drag.itemId, drop.date, drop.mealType, item.name);
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={view === "day" ? "default" : "ghost"}
            onClick={() => go(planHref({ week: weekStart, view: "day", day: selectedDay }))}
          >
            Dzień
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "week" ? "default" : "ghost"}
            onClick={() => go(planHref({ week: weekStart, view: "week", day: selectedDay }))}
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
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {view === "week" ? (
          <WeekGrid
            weekDays={weekDays}
            entries={entries}
            editable={editable}
            isDragging={isDragging}
            onOpenDay={(day) => go(planHref({ week: weekStart, view: "day", day }))}
          />
        ) : (
          <DayDetail
            selectedDay={selectedDay}
            entries={dayEntries}
            assignments={assignments}
            members={members}
            editable={editable}
            isDragging={isDragging}
          />
        )}

        {editable ? (
          <PlanPalette
            query={paletteQuery}
            onQueryChange={setPaletteQuery}
            recipes={filteredRecipes}
            ingredients={filteredIngredients}
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {weekDays.map((day) => (
          <Button
            key={day}
            size="sm"
            variant={selectedDay === day ? "default" : "outline"}
            onClick={() => onNavigate(planHref({ week: weekStart, view: "day", day }))}
          >
            {format(parseISO(day), "EEE d", { locale: pl })}
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

function WeekGrid({
  weekDays,
  entries,
  editable,
  isDragging,
  onOpenDay,
}: {
  weekDays: string[];
  entries: PlanEntry[];
  editable: boolean;
  isDragging: boolean;
  onOpenDay: (day: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[52rem] grid grid-cols-8 items-start gap-1.5">
        <div />
        {weekDays.map((day) => (
          <button
            key={day}
            type="button"
            className="rounded-md px-1 py-1 text-center text-xs font-medium hover:bg-accent"
            onClick={() => onOpenDay(day)}
          >
            {format(parseISO(day), "EEE d", { locale: pl })}
          </button>
        ))}
        {mealTypeEnum.map((mealType) => (
          <Fragment key={mealType}>
            <div className="pt-1 text-xs text-muted-foreground">{MEAL_TYPE_LABELS[mealType]}</div>
            {weekDays.map((day) => {
              const cellEntries = entries.filter((e) => e.date === day && e.mealType === mealType);
              return (
                <DroppablePlanCell
                  key={`${day}-${mealType}`}
                  id={`${day}|${mealType}`}
                  isDragging={isDragging}
                  empty={!cellEntries.length}
                  compact
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
  entries,
  assignments,
  members,
  editable,
  isDragging,
}: {
  selectedDay: string;
  entries: PlanEntry[];
  assignments: Assignment[];
  members: Member[];
  editable: boolean;
  isDragging: boolean;
}) {
  return (
    <div className="space-y-3">
      {mealTypeEnum.map((mealType) => {
        const typeEntries = entries.filter((e) => e.mealType === mealType);
        return (
          <DroppablePlanCell
            key={mealType}
            id={`${selectedDay}|${mealType}`}
            isDragging={isDragging}
            empty={!typeEntries.length}
            className="min-h-28"
          >
            <p className="mb-2 text-sm font-semibold">{MEAL_TYPE_LABELS[mealType]}</p>
            <div className="space-y-3">
              {typeEntries.map((entry) => (
                <DetailedEntryCard
                  key={entry.id}
                  entry={entry}
                  assignments={assignments.filter((a) => a.mealPlanEntryId === entry.id)}
                  members={members}
                  editable={editable}
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    disabled: !editable,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-1 rounded border bg-accent/40 px-1.5 py-1 text-[11px] leading-tight"
    >
      <button
        type="button"
        className={editable ? "min-w-0 flex-1 cursor-grab touch-none text-left font-medium" : "min-w-0 flex-1 text-left font-medium"}
        {...(editable ? listeners : {})}
        {...(editable ? attributes : {})}
        title={entry.itemName}
      >
        <span className="line-clamp-2">{entry.itemName}</span>
      </button>
      {editable ? (
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
          >
            ×
          </Button>
        </FeedbackForm>
      ) : null}
    </div>
  );
}

function DetailedEntryCard({
  entry,
  assignments,
  members,
  editable,
}: {
  entry: PlanEntry;
  assignments: Assignment[];
  members: Member[];
  editable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    disabled: !editable,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const statusLabel =
    entry.status === "prepared" ? "Przygotowane" : entry.status === "eaten" ? "Zjedzone" : "Zaplanowane";

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-accent/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className={
            editable
              ? "cursor-grab touch-none text-left text-base font-semibold"
              : "text-left text-base font-semibold"
          }
          {...(editable ? listeners : {})}
          {...(editable ? attributes : {})}
        >
          {entry.itemName}
        </button>
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

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{entry.sourceType === "recipe" ? "Przepis" : "Składnik"}</span>
        <span>{entry.servings} porcji</span>
        <span>{statusLabel}</span>
        {entry.isBatchCooking ? <span>Gotowanie na kilka dni</span> : null}
      </div>

      {entry.notes ? <p className="mt-2 text-sm">{entry.notes}</p> : null}

      {assignments.length ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Porcje domowników</p>
          {assignments.map((a) => (
            <p key={a.userId} className="text-sm">
              {a.displayName}: {a.servings}
            </p>
          ))}
        </div>
      ) : null}

      {editable ? (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Przypisz porcje</p>
            {members.map((member) => {
              const current = assignments.find((item) => item.userId === member.userId)?.servings ?? 0;
              return (
                <div key={member.userId} className="flex min-h-11 items-center justify-between gap-2">
                  <span className="truncate text-sm">{member.displayName}</span>
                  <div className="flex items-center gap-1">
                    <form action={assignPortionsAction}>
                      <input type="hidden" name="mealPlanEntryId" value={entry.id} />
                      <input type="hidden" name="userId" value={member.userId} />
                      <input type="hidden" name="servings" value={Math.max(0, current - 1)} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={current === 0}
                        aria-label={`Odejmij porcję: ${member.displayName}`}
                      >
                        −
                      </Button>
                    </form>
                    <span className="min-w-5 text-center text-sm">{current}</span>
                    <form action={assignPortionsAction}>
                      <input type="hidden" name="mealPlanEntryId" value={entry.id} />
                      <input type="hidden" name="userId" value={member.userId} />
                      <input type="hidden" name="servings" value={current + 1} />
                      <Button type="submit" variant="outline" size="sm" aria-label={`Dodaj porcję: ${member.displayName}`}>
                        +
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>

          <FeedbackForm
            action={updateMealPlanDetailsAction}
            successMessage="Zapisano szczegóły posiłku"
            errorMessage="Nie udało się zapisać szczegółów"
            className="space-y-2"
          >
            <input type="hidden" name="entryId" value={entry.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Porcje</span>
                <input
                  className="h-11 w-full rounded-lg border bg-background px-2"
                  type="number"
                  min="1"
                  name="servings"
                  defaultValue={entry.servings}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Status</span>
                <select
                  className="h-11 w-full rounded-lg border bg-background px-2"
                  name="status"
                  defaultValue={entry.status}
                >
                  <option value="planned">Zaplanowane</option>
                  <option value="prepared">Przygotowane</option>
                  <option value="eaten">Zjedzone</option>
                </select>
              </label>
            </div>
            <textarea
              className="min-h-20 w-full rounded-lg border bg-background p-2 text-sm"
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
  recipes,
  ingredients,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  recipes: PaletteItem[];
  ingredients: PaletteItem[];
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold">Przepisy i składniki</h2>
          <p className="text-sm text-muted-foreground">Przeciągnij na slot w planerze.</p>
        </div>
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Szukaj…"
          className="sm:max-w-xs"
          aria-label="Szukaj w palecie"
        />
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
}: {
  id: string;
  children: React.ReactNode;
  isDragging: boolean;
  empty: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      className={`h-auto transition-colors ${compact ? "min-h-14" : "min-h-20"} ${
        isOver ? "border-primary bg-accent" : ""
      } ${className}`}
    >
      <CardContent className={`flex h-full flex-col ${compact ? "gap-1 p-1.5" : "gap-2 p-3"}`}>
        {children}
        {empty ? (
          <p
            className={`mt-auto text-center ${compact ? "py-2 text-[10px]" : "py-3 text-xs"} ${
              isDragging ? "text-primary" : "text-muted-foreground/70"
            }`}
          >
            {isDragging ? "Upuść" : "—"}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
