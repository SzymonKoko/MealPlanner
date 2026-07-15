"use client";

import { useEffect, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  toggleShoppingItemAction,
  addManualShoppingItemAction,
} from "@/modules/shopping/actions/shopping-actions";

interface ShoppingItem {
  id: string;
  name: string;
  quantityToBuy: string;
  unit: string;
  checked: boolean;
  source: string;
  categoryId: string | null;
}

interface ShoppingListViewProps {
  listId: string;
  items: ShoppingItem[];
}

export function ShoppingListView({ listId, items: initialItems }: ShoppingListViewProps) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [lastSync, setLastSync] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/shopping/sync");
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          setLastSync(new Date());
        }
      } catch {
        // offline — keep local state
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  function handleToggle(itemId: string, checked: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, checked } : i)),
    );

    if ("indexedDB" in window) {
      cacheCheckboxOffline(itemId, checked);
    }

    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("checked", String(checked));
    startTransition(() => toggleShoppingItemAction(formData));
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Ostatnia synchronizacja: {lastSync.toLocaleTimeString("pl-PL")}
        {isPending ? " · zapisywanie..." : ""}
      </p>

      <form
        action={addManualShoppingItemAction}
        className="flex flex-wrap gap-2"
      >
        <input type="hidden" name="shoppingListId" value={listId} />
        <Input name="name" placeholder="Nazwa produktu" className="flex-1 min-w-32" required />
        <Input name="quantityToBuy" placeholder="Ilość" className="w-20" required defaultValue="1" />
        <Input name="unit" placeholder="Jedn." className="w-16" defaultValue="szt" />
        <Button type="submit" size="sm">
          Dodaj
        </Button>
      </form>

      <div className="space-y-2">
        {unchecked.map((item) => (
          <ShoppingItemRow key={item.id} item={item} onToggle={handleToggle} />
        ))}
      </div>

      {checked.length > 0 ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground">Kupione</p>
          {checked.map((item) => (
            <ShoppingItemRow key={item.id} item={item} onToggle={handleToggle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ShoppingItemRow({
  item,
  onToggle,
}: {
  item: ShoppingItem;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <Card className={item.checked ? "opacity-60" : ""}>
      <CardContent className="flex items-center gap-3 p-3">
        <Checkbox
          checked={item.checked}
          onCheckedChange={(v) => onToggle(item.id, v === true)}
          aria-label={`Zaznacz ${item.name}`}
        />
        <div className="flex-1">
          <p className={item.checked ? "line-through" : "font-medium"}>{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {item.quantityToBuy} {item.unit}
            {item.source === "manual" ? " · ręczne" : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function cacheCheckboxOffline(itemId: string, checked: boolean) {
  try {
    const key = "mealplanner-shopping-offline";
    const existing = JSON.parse(localStorage.getItem(key) ?? "{}");
    existing[itemId] = checked;
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // ignore
  }
}
