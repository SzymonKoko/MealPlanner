"use client";

import { Fragment, useState } from "react";
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
  copyMealPlanEntryAction,
  copyPreviousWeekAction,
  assignPortionsAction,
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
}

export function MealPlanView({
  weekStart,
  entries: initialEntries,
  assignments: initialAssignments,
  recipes,
  members,
}: MealPlanViewProps) {
  const [entries] = useState(initialEntries);
  const [assignments] = useState(initialAssignments);
  const [selectedDay, setSelectedDay] = useState(weekStart);
  const [moveEntryId, setMoveEntryId] = useState<string | null>(null);

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
    await moveMealPlanEntryAction(formData);
    setMoveEntryId(null);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
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

      <form
        action={copyPreviousWeekAction}
        className="flex flex-wrap gap-2"
      >
        <input type="hidden" name="sourceWeekStart" value={format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd")} />
        <input type="hidden" name="targetWeekStart" value={weekStart} />
        <Button type="submit" variant="secondary" size="sm">
          Kopiuj poprzedni tydzień
        </Button>
      </form>

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
                <Card key={`${day}-${mealType}`} className="min-h-20">
                  <CardContent className="p-2 space-y-1">
                    {cellEntries.map((entry) => (
                      <PlanEntryCard
                        key={entry.id}
                        entry={entry}
                        assignments={assignments.filter((a) => a.mealPlanEntryId === entry.id)}
                        members={members}
                        onDelete={() => deleteMealPlanEntryAction(entry.id).then(() => window.location.reload())}
                        onCopy={() => copyMealPlanEntryAction(entry.id).then(() => window.location.reload())}
                        onMove={(date, mt) => handleMove(entry.id, date, mt)}
                        weekDays={weekDays}
                      />
                    ))}
                    <AddRecipeSelect recipes={recipes} onAdd={(id) => handleAdd(id, mealType)} />
                  </CardContent>
                </Card>
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
            <Card key={mealType}>
              <CardContent className="p-4 space-y-2">
                <p className="font-medium">{MEAL_TYPE_LABELS[mealType]}</p>
                {typeEntries.map((entry) => (
                  <PlanEntryCard
                    key={entry.id}
                    entry={entry}
                    assignments={assignments.filter((a) => a.mealPlanEntryId === entry.id)}
                    members={members}
                    onDelete={() => deleteMealPlanEntryAction(entry.id).then(() => window.location.reload())}
                    onCopy={() => copyMealPlanEntryAction(entry.id).then(() => window.location.reload())}
                    onMove={(date, mt) => handleMove(entry.id, date, mt)}
                    weekDays={weekDays}
                    showMoveButton
                    moveEntryId={moveEntryId}
                    setMoveEntryId={setMoveEntryId}
                  />
                ))}
                <AddRecipeSelect recipes={recipes} onAdd={(id) => handleAdd(id, mealType)} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PlanEntryCard({
  entry,
  assignments,
  members,
  onDelete,
  onCopy,
  onMove,
  weekDays,
  showMoveButton,
  moveEntryId,
  setMoveEntryId,
}: {
  entry: PlanEntry;
  assignments: Assignment[];
  members: Member[];
  onDelete: () => void;
  onCopy: () => void;
  onMove: (date: string, mealType: MealType) => void;
  weekDays: string[];
  showMoveButton?: boolean;
  moveEntryId?: string | null;
  setMoveEntryId?: (id: string | null) => void;
}) {
  return (
    <div className="rounded-md border bg-accent/30 p-2 text-sm">
      <p className="font-medium">{entry.recipeName}</p>
      <p className="text-xs text-muted-foreground">{entry.servings} porcji</p>
      {assignments.map((a) => (
        <p key={a.userId} className="text-xs">
          {a.displayName}: {a.servings}
        </p>
      ))}
      <div className="mt-1 flex flex-wrap gap-1">
        {members.map((m) => (
          <form key={m.userId} action={assignPortionsAction}>
            <input type="hidden" name="mealPlanEntryId" value={entry.id} />
            <input type="hidden" name="userId" value={m.userId} />
            <input type="hidden" name="servings" value="1" />
            <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">
              +{m.displayName.slice(0, 8)}
            </Button>
          </form>
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCopy}>
          Kopiuj
        </Button>
        {showMoveButton && setMoveEntryId ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setMoveEntryId(moveEntryId === entry.id ? null : entry.id)}
          >
            Przenieś
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={onDelete}>
          Usuń
        </Button>
      </div>
      {moveEntryId === entry.id ? (
        <div className="mt-2 space-y-2">
          <Select onValueChange={(day) => onMove(day, entry.mealType)}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Wybierz dzień" />
            </SelectTrigger>
            <SelectContent>
              {weekDays.map((day) => (
                <SelectItem key={day} value={day}>
                  {format(parseISO(day), "EEE d MMM", { locale: pl })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(mt) => onMove(entry.date, mt as MealType)}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Wybierz porę" />
            </SelectTrigger>
            <SelectContent>
              {mealTypeEnum.map((mt) => (
                <SelectItem key={mt} value={mt}>
                  {MEAL_TYPE_LABELS[mt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
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
