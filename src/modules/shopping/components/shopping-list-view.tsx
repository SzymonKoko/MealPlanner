"use client";

import { useEffect, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  toggleShoppingItemAction,
  addManualShoppingItemAction,
  updateManualShoppingItemAction,
  deleteManualShoppingItemAction,
} from "@/modules/shopping/actions/shopping-actions";
import { SUPPORTED_UNITS } from "@/lib/units";

const OFFLINE_KEY = "mealplanner-shopping-offline";

interface ShoppingItem {
  id: string;
  name: string;
  quantityToBuy: string;
  unit: string;
  checked: boolean;
  source: string;
  categoryId: string | null;
  categoryName: string;
  notes: string | null;
}

interface ShoppingListViewProps {
  listId: string;
  items: ShoppingItem[];
  editable: boolean;
}

export function ShoppingListView({ listId, items: initialItems, editable }: ShoppingListViewProps) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [lastSync, setLastSync] = useState(new Date());

  useEffect(() => {
    const pending = readOfflineChanges(listId);
    if (Object.keys(pending).length) {
      setItems((current) =>
        current.map((item) =>
          pending[item.id] === undefined ? item : { ...item, checked: pending[item.id] },
        ),
      );
    }

    async function replayOfflineChanges() {
      const changes = readOfflineChanges(listId);
      for (const [itemId, checked] of Object.entries(changes)) {
        try {
          const formData = new FormData();
          formData.set("itemId", itemId);
          formData.set("checked", String(checked));
          await toggleShoppingItemAction(formData);
          removeOfflineChange(listId, itemId);
        } catch {
          return;
        }
      }
    }
    void replayOfflineChanges();
    window.addEventListener("online", replayOfflineChanges);

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/shopping/sync");
        if (res.ok) {
          const data = await res.json();
          if (data.list === null) {
            window.location.reload();
            return;
          }
          const localChanges = readOfflineChanges(listId);
          setItems(
            data.items.map((item: ShoppingItem) =>
              localChanges[item.id] === undefined
                ? item
                : { ...item, checked: localChanges[item.id] },
            ),
          );
          setLastSync(new Date());
        }
      } catch {
        // offline — keep local state
      }
    }, 8000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", replayOfflineChanges);
    };
  }, [listId]);

  function handleToggle(itemId: string, checked: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, checked } : i)),
    );

    cacheCheckboxOffline(listId, itemId, checked);

    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("checked", String(checked));
    startTransition(async () => {
      try {
        await toggleShoppingItemAction(formData);
        removeOfflineChange(listId, itemId);
      } catch {
        cacheCheckboxOffline(listId, itemId, checked);
      }
    });
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Ostatnia synchronizacja: {lastSync.toLocaleTimeString("pl-PL")}
        {isPending ? " · zapisywanie..." : ""}
      </p>

      {editable ? <form
        action={addManualShoppingItemAction}
        className="flex flex-wrap gap-2"
      >
        <input type="hidden" name="shoppingListId" value={listId} />
        <Input name="name" placeholder="Nazwa produktu" className="flex-1 min-w-32" required />
        <Input name="quantityToBuy" placeholder="Ilość" className="w-20" required defaultValue="1" />
        <select name="unit" defaultValue="szt" className="h-11 rounded-lg border bg-background px-2">
          {SUPPORTED_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
        <Input name="notes" placeholder="Komentarz" className="min-w-32 flex-1" />
        <Button type="submit" size="sm">
          Dodaj
        </Button>
      </form> : null}

      <GroupedItems items={unchecked} onToggle={handleToggle} editable={editable} />

      {checked.length > 0 ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground">Kupione</p>
          <GroupedItems items={checked} onToggle={handleToggle} editable={editable} />
        </div>
      ) : null}
    </div>
  );
}

function GroupedItems({
  items,
  onToggle,
  editable,
}: {
  items: ShoppingItem[];
  onToggle: (id: string, checked: boolean) => void;
  editable: boolean;
}) {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    groups.set(item.categoryName, [...(groups.get(item.categoryName) ?? []), item]);
  }
  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([category, categoryItems]) => (
        <section key={category} className="space-y-2">
          <h3 className="text-sm font-semibold">{category}</h3>
          {categoryItems.map((item) => (
            <ShoppingItemRow key={item.id} item={item} onToggle={onToggle} editable={editable} />
          ))}
        </section>
      ))}
    </div>
  );
}

function ShoppingItemRow({
  item,
  onToggle,
  editable,
}: {
  item: ShoppingItem;
  onToggle: (id: string, checked: boolean) => void;
  editable: boolean;
}) {
  return (
    <Card className={item.checked ? "opacity-60" : ""}>
      <CardContent className="flex items-center gap-3 p-3">
        <Checkbox
          checked={item.checked}
          onCheckedChange={(v) => onToggle(item.id, v === true)}
          aria-label={`Zaznacz ${item.name}`}
          disabled={!editable}
        />
        <div className="flex-1">
          <p className={item.checked ? "line-through" : "font-medium"}>{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {item.quantityToBuy} {item.unit}
            {item.source === "manual" ? " · ręczne" : ""}
          </p>
          {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
        </div>
        {editable && item.source === "manual" ? (
          <details>
            <summary className="cursor-pointer text-xs">Edytuj</summary>
            <form action={updateManualShoppingItemAction.bind(null, item.id)} className="mt-2 space-y-2">
              <Input name="name" defaultValue={item.name} required />
              <Input name="quantityToBuy" defaultValue={item.quantityToBuy} required />
              <select name="unit" defaultValue={item.unit} className="h-11 w-full rounded-lg border bg-background px-2">
                {SUPPORTED_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
              <Input name="notes" defaultValue={item.notes ?? ""} placeholder="Komentarz" />
              <div className="flex gap-2">
                <Button type="submit" size="sm">Zapisz</Button>
                <Button formAction={deleteManualShoppingItemAction.bind(null, item.id)} type="submit" size="sm" variant="ghost" className="text-destructive">Usuń</Button>
              </div>
            </form>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function cacheCheckboxOffline(listId: string, itemId: string, checked: boolean) {
  try {
    const existing = readOfflineChanges(listId);
    existing[itemId] = checked;
    localStorage.setItem(`${OFFLINE_KEY}:${listId}`, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

function readOfflineChanges(listId: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(`${OFFLINE_KEY}:${listId}`) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function removeOfflineChange(listId: string, itemId: string) {
  const existing = readOfflineChanges(listId);
  delete existing[itemId];
  localStorage.setItem(`${OFFLINE_KEY}:${listId}`, JSON.stringify(existing));
}
