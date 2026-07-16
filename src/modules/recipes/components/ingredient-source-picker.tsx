"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pl")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function matchesSearchQuery(haystack: string, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(haystack).includes(normalizedQuery);
}

interface SourceOption {
  id: string;
  name: string;
  type: "ingredient" | "product";
}

interface IngredientSourcePickerProps {
  sources: SourceOption[];
  value: { sourceId: string; sourceType: "ingredient" | "product" };
  onChange: (next: { sourceId: string; sourceType: "ingredient" | "product" }) => void;
  className?: string;
}

export function IngredientSourcePicker({
  sources,
  value,
  onChange,
  className,
}: IngredientSourcePickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = sources.find((source) => source.id === value.sourceId && source.type === value.sourceType);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.name ?? "");

  useEffect(() => {
    if (!open) {
      setQuery(selected?.name ?? "");
    }
  }, [open, selected?.name]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filtered = useMemo(() => {
    const matches = sources.filter((source) => matchesSearchQuery(source.name, query));
    if (selected && !matches.some((source) => source.id === selected.id && source.type === selected.type)) {
      return [selected, ...matches];
    }
    return matches;
  }, [sources, query, selected]);

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        placeholder="Szukaj składnika…"
        className="h-9"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (selected && event.target.value !== selected.name) {
            onChange({ sourceId: "", sourceType: "ingredient" });
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setQuery(selected?.name ?? "");
          }
          if (event.key === "Enter" && open && filtered[0]) {
            event.preventDefault();
            onChange({ sourceId: filtered[0].id, sourceType: filtered[0].type });
            setQuery(filtered[0].name);
            setOpen(false);
          }
        }}
        required={!value.sourceId}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-background py-1 text-sm shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Brak wyników</li>
          ) : (
            filtered.slice(0, 40).map((source) => {
              const active = source.id === value.sourceId && source.type === value.sourceType;
              return (
                <li key={`${source.type}:${source.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-center px-3 py-1.5 text-left hover:bg-accent",
                      active && "bg-accent font-medium",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange({ sourceId: source.id, sourceType: source.type });
                      setQuery(source.name);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{source.name}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
