"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackForm } from "@/components/shared/feedback-form";
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

function mergeWithOffline(listId: string, serverItems: ShoppingItem[]) {
  const pending = readOfflineChanges(listId);
  return serverItems.map((item) =>
    pending[item.id] === undefined ? item : { ...item, checked: pending[item.id] },
  );
}

export function ShoppingListView({ listId, items: initialItems, editable }: ShoppingListViewProps) {
  const router = useRouter();
  const [items, setItems] = useState(() => mergeWithOffline(listId, initialItems));
  const [isPending, startTransition] = useTransition();
  const [lastSync, setLastSync] = useState(new Date());

  useEffect(() => {
    setItems(mergeWithOffline(listId, initialItems));
  }, [initialItems, listId]);

  useEffect(() => {
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
      router.refresh();
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
          setItems(mergeWithOffline(listId, data.items));
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
  }, [listId, router]);

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
        router.refresh();
      } catch {
        cacheCheckboxOffline(listId, itemId, checked);
        toast.error("Nie udało się zapisać zaznaczenia");
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

      {editable ? (
        <FeedbackForm
          action={addManualShoppingItemAction}
          successMessage="Dodano pozycję do listy"
          errorMessage="Nie udało się dodać pozycji"
          className="flex flex-wrap gap-2"
        >
          <input type="hidden" name="shoppingListId" value={listId} />
          <Input name="name" placeholder="Nazwa produktu" className="flex-1 min-w-32" required />
          <Input name="quantityToBuy" placeholder="Ilość" className="w-20" required defaultValue="1" />
          <select name="unit" defaultValue="szt" className="h-11 rounded-lg border bg-background px-2">
            {SUPPORTED_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <Input name="notes" placeholder="Komentarz" className="min-w-32 flex-1" />
          <Button type="submit" size="sm">
            Dodaj
          </Button>
        </FeedbackForm>
      ) : null}

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
            <FeedbackForm
              action={updateManualShoppingItemAction.bind(null, item.id)}
              successMessage="Zapisano pozycję"
              errorMessage="Nie udało się zapisać pozycji"
              className="mt-2 space-y-2"
            >
              <Input name="name" defaultValue={item.name} required />
              <Input name="quantityToBuy" defaultValue={item.quantityToBuy} required />
              <select name="unit" defaultValue={item.unit} className="h-11 w-full rounded-lg border bg-background px-2">
                {SUPPORTED_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              <Input name="notes" defaultValue={item.notes ?? ""} placeholder="Komentarz" />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Zapisz
                </Button>
                <DeleteManualItemButton itemId={item.id} />
              </div>
            </FeedbackForm>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeleteManualItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-destructive"
      onClick={() => {
        void (async () => {
          try {
            await deleteManualShoppingItemAction(itemId);
            toast.success("Usunięto pozycję");
            router.refresh();
          } catch {
            toast.error("Nie udało się usunąć pozycji");
          }
        })();
      }}
    >
      Usuń
    </Button>
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
