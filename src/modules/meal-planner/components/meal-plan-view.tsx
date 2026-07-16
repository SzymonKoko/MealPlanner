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
import {
  addMealPlanEntryAction,
  moveMealPlanEntryAction,
  deleteMealPlanEntryAction,
  copyMealPlanEntryToAction,
  copyPreviousWeekAction,
  assignPortionsAction,
  updateMealPlanDetailsAction,
} from "@/modules/meal-planner/actions/meal-plan-actions";

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

export function MealPlanView({
  weekStart,
  entries: initialEntries,
  assignments: initialAssignments,
  recipes,
  ingredients,
  members,
  editable,
}: MealPlanViewProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedDay, setSelectedDay] = useState(weekStart);
  const [moveEntryId, setMoveEntryId] = useState<string | null>(null);
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

  const navigateWeek = (offset: number) => {
    const newStart = format(addDays(parseISO(weekStart), offset * 7), "yyyy-MM-dd");
    window.location.href = `/plan?week=${newStart}`;
  };

  const dayEntries = entries.filter((e) => e.date === selectedDay);

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
      setMoveEntryId(null);
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
    const palette =
      parsed.kind === "recipe"
        ? recipes
        : ingredients;
    setActiveDragLabel(palette.find((item) => item.id === parsed.itemId)?.name ?? "Element");
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

  const palette = editable ? (
    <PlanPalette
      query={paletteQuery}
      onQueryChange={setPaletteQuery}
      recipes={filteredRecipes}
      ingredients={filteredIngredients}
    />
  ) : null;

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigateWeek(-1)}>
          Poprzedni
        </Button>
        <span className="font-medium">
          {format(parseISO(weekStart), "d MMM", { locale: pl })} –{" "}
          {format(addDays(parseISO(weekStart), 6), "d MMM yyyy", { locale: pl })}
        </span>
        <Button variant="outline" onClick={() => navigateWeek(1)}>
          Następny
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 md:hidden">
        {weekDays.map((day) => (
          <Button
            key={day}
            variant={selectedDay === day ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDay(day)}
          >
            {format(parseISO(day), "EEE d", { locale: pl })}
          </Button>
        ))}
      </div>

      {editable ? (
        <FeedbackForm action={copyPreviousWeekAction} successMessage="Skopiowano poprzedni tydzień" className="flex flex-wrap gap-2">
          <input type="hidden" name="sourceWeekStart" value={format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd")} />
          <input type="hidden" name="targetWeekStart" value={weekStart} />
          <Button type="submit" variant="secondary" size="sm">Kopiuj poprzedni tydzień</Button>
        </FeedbackForm>
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="hidden md:grid md:grid-cols-8 md:items-start md:gap-2">
          <div />
          {weekDays.map((day) => (
            <div key={day} className="text-center text-sm font-medium">
              {format(parseISO(day), "EEE d", { locale: pl })}
            </div>
          ))}
          {mealTypeEnum.map((mealType) => (
            <Fragment key={mealType}>
              <div className="pt-2 text-sm text-muted-foreground">
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
                  >
                    {cellEntries.map((entry) => (
                      <PlanEntryCard
                        key={entry.id}
                        entry={entry}
                        assignments={assignments.filter((a) => a.mealPlanEntryId === entry.id)}
                        members={members}
                        onMove={(date, mt) => handleMove(entry.id, date, mt)}
                        weekDays={weekDays}
                        editable={editable}
                        draggable={editable}
                        moveEntryId={moveEntryId}
                        setMoveEntryId={setMoveEntryId}
                      />
                    ))}
                  </DroppablePlanCell>
                );
              })}
            </Fragment>
          ))}
        </div>

        <div className="space-y-4 md:hidden">
          <h2 className="font-semibold">
            {format(parseISO(selectedDay), "EEEE, d MMMM", { locale: pl })}
          </h2>
          {mealTypeEnum.map((mealType) => {
            const typeEntries = dayEntries.filter((e) => e.mealType === mealType);
            return (
              <DroppablePlanCell
                key={mealType}
                id={`${selectedDay}|${mealType}`}
                isDragging={isDragging}
                empty={!typeEntries.length}
                className="min-h-24"
              >
                <p className="mb-2 font-medium">{MEAL_TYPE_LABELS[mealType]}</p>
                {typeEntries.map((entry) => (
                  <PlanEntryCard
                    key={entry.id}
                    entry={entry}
                    assignments={assignments.filter((a) => a.mealPlanEntryId === entry.id)}
                    members={members}
                    onMove={(date, mt) => handleMove(entry.id, date, mt)}
                    weekDays={weekDays}
                    editable={editable}
                    draggable={editable}
                    moveEntryId={moveEntryId}
                    setMoveEntryId={setMoveEntryId}
                  />
                ))}
              </DroppablePlanCell>
            );
          })}
        </div>

        {palette}

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
          <p className="text-sm text-muted-foreground">
            Przeciągnij element na slot w planerze (np. sam skyr na śniadanie).
          </p>
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
              recipes.map((item) => (
                <PaletteChip key={`recipe-${item.id}`} item={item} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Brak przepisów.</p>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Składniki</p>
          <div className="flex flex-wrap gap-2">
            {ingredients.length ? (
              ingredients.map((item) => (
                <PaletteChip key={`${item.kind}-${item.id}`} item={item} />
              ))
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
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  isDragging: boolean;
  empty: boolean;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      className={`h-auto min-h-20 transition-colors ${isOver ? "border-primary bg-accent" : ""} ${className}`}
    >
      <CardContent className="flex h-full flex-col gap-2 p-2">
        {children}
        {empty ? (
          <p
            className={`mt-auto py-3 text-center text-xs ${
              isDragging ? "text-primary" : "text-muted-foreground/70"
            }`}
          >
            {isDragging ? "Upuść tutaj" : "Pusto"}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlanEntryCard({
  entry,
  assignments,
  members,
  onMove,
  weekDays,
  editable,
  draggable = false,
  moveEntryId,
  setMoveEntryId,
}: {
  entry: PlanEntry;
  assignments: Assignment[];
  members: Member[];
  onMove: (date: string, mealType: MealType) => Promise<void>;
  weekDays: string[];
  editable: boolean;
  draggable?: boolean;
  moveEntryId?: string | null;
  setMoveEntryId?: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    disabled: !draggable,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-accent/30 p-2 text-sm">
      <button
        type="button"
        className={draggable ? "cursor-grab touch-none text-left font-medium" : "text-left font-medium"}
        {...(draggable ? listeners : {})}
        {...(draggable ? attributes : {})}
      >
        {entry.itemName}
      </button>
      <p className="text-xs text-muted-foreground">
        {entry.sourceType === "recipe" ? "Przepis" : "Składnik"} · {entry.servings} porcji
      </p>
      {entry.status !== "planned" ? (
        <p className="text-xs text-muted-foreground">
          {entry.status === "prepared" ? "Przygotowane" : "Zjedzone"}
        </p>
      ) : null}
      {entry.isBatchCooking ? <p className="text-xs text-muted-foreground">Gotowanie na kilka dni</p> : null}
      {assignments.map((a) => (
        <p key={a.userId} className="text-xs">
          {a.displayName}: {a.servings}
        </p>
      ))}
      {editable ? (
        <div className="mt-2 space-y-2">
          {members.map((member) => {
            const current = assignments.find((item) => item.userId === member.userId)?.servings ?? 0;
            return (
              <div key={member.userId} className="flex min-h-11 items-center justify-between gap-2">
                <span className="truncate text-xs">{member.displayName}</span>
                <div className="flex items-center gap-1">
                  <form
                    action={async (formData) => {
                      await assignPortionsAction(formData);
                    }}
                  >
                    <input type="hidden" name="mealPlanEntryId" value={entry.id} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <input type="hidden" name="servings" value={Math.max(0, current - 1)} />
                    <Button type="submit" variant="outline" size="sm" disabled={current === 0} aria-label={`Odejmij porcję: ${member.displayName}`}>−</Button>
                  </form>
                  <span className="min-w-5 text-center text-xs">{current}</span>
                  <form
                    action={async (formData) => {
                      await assignPortionsAction(formData);
                    }}
                  >
                    <input type="hidden" name="mealPlanEntryId" value={entry.id} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <input type="hidden" name="servings" value={current + 1} />
                    <Button type="submit" variant="outline" size="sm" aria-label={`Dodaj porcję: ${member.displayName}`}>+</Button>
                  </form>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-1">
          {setMoveEntryId ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setMoveEntryId(moveEntryId === entry.id ? null : entry.id)}
            >
              Przenieś / kopiuj
            </Button>
          ) : null}
          <FeedbackForm
            action={deleteMealPlanEntryAction.bind(null, entry.id)}
            successMessage="Usunięto posiłek z planu"
            errorMessage="Nie udało się usunąć posiłku"
          >
            <Button type="submit" variant="ghost" size="sm" className="text-xs text-destructive">Usuń</Button>
          </FeedbackForm>
          </div>
          <details>
            <summary className="cursor-pointer text-xs font-medium">Porcje, status i notatka</summary>
            <FeedbackForm
              action={updateMealPlanDetailsAction}
              successMessage="Zapisano szczegóły posiłku"
              errorMessage="Nie udało się zapisać szczegółów"
              className="mt-2 space-y-2"
            >
              <input type="hidden" name="entryId" value={entry.id} />
              <input className="h-11 w-full rounded-lg border bg-background px-2" type="number" min="1" name="servings" defaultValue={entry.servings} aria-label="Liczba porcji" />
              <select className="h-11 w-full rounded-lg border bg-background px-2" name="status" defaultValue={entry.status} aria-label="Status posiłku">
                <option value="planned">Zaplanowane</option>
                <option value="prepared">Przygotowane</option>
                <option value="eaten">Zjedzone</option>
              </select>
              <textarea className="min-h-20 w-full rounded-lg border bg-background p-2" name="notes" defaultValue={entry.notes ?? ""} placeholder="Notatka" />
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input type="checkbox" name="isBatchCooking" value="true" defaultChecked={entry.isBatchCooking} />
                Gotowanie na kilka dni
              </label>
              <Button type="submit" size="sm">Zapisz</Button>
            </FeedbackForm>
          </details>
        </div>
      ) : null}
      {moveEntryId === entry.id ? (
        <MoveOrCopyForm entry={entry} weekDays={weekDays} onMove={onMove} />
      ) : null}
    </div>
  );
}

function MoveOrCopyForm({
  entry,
  weekDays,
  onMove,
}: {
  entry: PlanEntry;
  weekDays: string[];
  onMove: (date: string, mealType: MealType) => Promise<void>;
}) {
  const [date, setDate] = useState(entry.date);
  const [mealType, setMealType] = useState<MealType>(entry.mealType);
  return (
    <div className="mt-2 space-y-2">
      <select className="h-11 w-full rounded-lg border bg-background px-2" value={date} onChange={(event) => setDate(event.target.value)}>
        {weekDays.map((day) => <option key={day} value={day}>{format(parseISO(day), "EEE d MMM", { locale: pl })}</option>)}
      </select>
      <select className="h-11 w-full rounded-lg border bg-background px-2" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>
        {mealTypeEnum.map((type) => <option key={type} value={type}>{MEAL_TYPE_LABELS[type]}</option>)}
      </select>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void onMove(date, mealType).catch(() => undefined)}>Przenieś</Button>
        <FeedbackForm action={copyMealPlanEntryToAction} successMessage="Skopiowano posiłek">
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="mealType" value={mealType} />
          <Button type="submit" size="sm" variant="secondary">Kopiuj</Button>
        </FeedbackForm>
      </div>
    </div>
  );
}
