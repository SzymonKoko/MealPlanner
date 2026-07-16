"use client";

import { Fragment, useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { addDays, format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MEAL_TYPE_LABELS, mealTypeEnum } from "@/lib/meal-types";
import type { MealType } from "@/db/schema/meal-planner";
import {
  addMealPlanEntryAction,
  moveMealPlanEntryAction,
  deleteMealPlanEntryAction,
  copyMealPlanEntryToAction,
  copyPreviousWeekAction,
  assignPortionsAction,
  updateMealPlanDetailsAction,
} from "@/modules/meal-planner/actions/meal-plan-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PlanEntry {
  id: string;
  recipeId: string;
  recipeName: string;
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

interface Recipe {
  id: string;
  name: string;
}

interface MealPlanViewProps {
  weekStart: string;
  entries: PlanEntry[];
  assignments: Assignment[];
  recipes: Recipe[];
  members: Member[];
  editable: boolean;
}

export function MealPlanView({
  weekStart,
  entries: initialEntries,
  assignments: initialAssignments,
  recipes,
  members,
  editable,
}: MealPlanViewProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedDay, setSelectedDay] = useState(weekStart);
  const [moveEntryId, setMoveEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setEntries(initialEntries);
    setAssignments(initialAssignments);
  }, [initialAssignments, initialEntries]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"),
  );

  const navigateWeek = (offset: number) => {
    const newStart = format(addDays(parseISO(weekStart), offset * 7), "yyyy-MM-dd");
    window.location.href = `/plan?week=${newStart}`;
  };

  const dayEntries = entries.filter((e) => e.date === selectedDay);

  async function handleAdd(recipeId: string, mealType: MealType) {
    const formData = new FormData();
    formData.set("recipeId", recipeId);
    formData.set("date", selectedDay);
    formData.set("mealType", mealType);
    formData.set("servings", "1");
    await addMealPlanEntryAction(formData);
    window.location.reload();
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
        current.map((entry) => entry.id === entryId ? { ...entry, date, mealType } : entry),
      );
      setMoveEntryId(null);
    } catch {
      setError("Nie udało się przenieść posiłku. Odśwież widok i spróbuj ponownie.");
      throw new Error("Meal plan move failed");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const [date, mealType] = String(event.over.id).split("|") as [string, MealType];
    const entryId = String(event.active.id);
    const entry = entries.find((item) => item.id === entryId);
    if (!entry || (entry.date === date && entry.mealType === mealType)) return;
    void handleMove(entryId, date, mealType).catch(() => undefined);
  }

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
        <form action={copyPreviousWeekAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="sourceWeekStart" value={format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd")} />
          <input type="hidden" name="targetWeekStart" value={weekStart} />
          <Button type="submit" variant="secondary" size="sm">Kopiuj poprzedni tydzień</Button>
        </form>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="hidden md:grid md:grid-cols-8 md:gap-2">
        <div />
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm font-medium">
            {format(parseISO(day), "EEE d", { locale: pl })}
          </div>
        ))}
        {mealTypeEnum.map((mealType) => (
          <Fragment key={mealType}>
            <div className="text-sm text-muted-foreground">
              {MEAL_TYPE_LABELS[mealType]}
            </div>
            {weekDays.map((day) => {
              const cellEntries = entries.filter((e) => e.date === day && e.mealType === mealType);
              return (
                <DroppablePlanCell key={`${day}-${mealType}`} id={`${day}|${mealType}`}>
                  <CardContent className="space-y-1 p-2">
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
                    {editable ? <AddRecipeSelect recipes={recipes} onAdd={(id) => handleAdd(id, mealType)} /> : null}
                  </CardContent>
                </DroppablePlanCell>
              );
            })}
          </Fragment>
        ))}
      </div>
      </DndContext>

      <div className="space-y-4 md:hidden">
        <h2 className="font-semibold">
          {format(parseISO(selectedDay), "EEEE, d MMMM", { locale: pl })}
        </h2>
        {mealTypeEnum.map((mealType) => {
          const typeEntries = dayEntries.filter((e) => e.mealType === mealType);
          return (
            <Card key={mealType}>
              <CardContent className="p-4 space-y-2">
                <p className="font-medium">{MEAL_TYPE_LABELS[mealType]}</p>
                {typeEntries.map((entry) => (
                  <PlanEntryCard
                    key={entry.id}
                    entry={entry}
                    assignments={assignments.filter((a) => a.mealPlanEntryId === entry.id)}
                    members={members}
                    onMove={(date, mt) => handleMove(entry.id, date, mt)}
                    weekDays={weekDays}
                    editable={editable}
                    moveEntryId={moveEntryId}
                    setMoveEntryId={setMoveEntryId}
                  />
                ))}
                {editable ? <AddRecipeSelect recipes={recipes} onAdd={(id) => handleAdd(id, mealType)} /> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DroppablePlanCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      className={`min-h-20 transition-colors ${isOver ? "border-primary bg-accent" : ""}`}
    >
      {children}
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
    id: entry.id,
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
        className={draggable ? "cursor-grab touch-none font-medium" : "font-medium"}
        {...(draggable ? listeners : {})}
        {...(draggable ? attributes : {})}
      >
        {entry.recipeName}
      </button>
      <p className="text-xs text-muted-foreground">{entry.servings} porcji</p>
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
                  <form action={assignPortionsAction}>
                    <input type="hidden" name="mealPlanEntryId" value={entry.id} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <input type="hidden" name="servings" value={Math.max(0, current - 1)} />
                    <Button type="submit" variant="outline" size="sm" disabled={current === 0} aria-label={`Odejmij porcję: ${member.displayName}`}>−</Button>
                  </form>
                  <span className="min-w-5 text-center text-xs">{current}</span>
                  <form action={assignPortionsAction}>
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
          <form action={deleteMealPlanEntryAction.bind(null, entry.id)}>
            <Button type="submit" variant="ghost" size="sm" className="text-xs text-destructive">Usuń</Button>
          </form>
          </div>
          <details>
            <summary className="cursor-pointer text-xs font-medium">Porcje, status i notatka</summary>
            <form action={updateMealPlanDetailsAction} className="mt-2 space-y-2">
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
            </form>
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
        <form action={copyMealPlanEntryToAction}>
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="mealType" value={mealType} />
          <Button type="submit" size="sm" variant="secondary">Kopiuj</Button>
        </form>
      </div>
    </div>
  );
}

function AddRecipeSelect({ recipes, onAdd }: { recipes: Recipe[]; onAdd: (id: string) => void }) {
  if (!recipes.length) return null;
  return (
    <Select onValueChange={onAdd}>
      <SelectTrigger className="h-8 mt-1">
        <SelectValue placeholder="+ Dodaj przepis" />
      </SelectTrigger>
      <SelectContent>
        {recipes.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
