"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AddMode = "closed" | "chooser" | "manual";

export function AddIngredientPanel({ manualForm }: { manualForm: React.ReactNode }) {
  const [mode, setMode] = useState<AddMode>("closed");

  if (mode === "closed") {
    return (
      <Button type="button" className="w-full sm:w-auto" onClick={() => setMode("chooser")}>
        Dodaj składnik
      </Button>
    );
  }

  if (mode === "chooser") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-lg">Jak chcesz dodać?</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("closed")}>
            Anuluj
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Button asChild className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left">
            <Link href="/ingredients/scan">
              <span className="block font-medium">Skanuj kod</span>
              <span className="mt-0.5 block text-xs font-normal opacity-90">Produkt sklepowy (Open Food Facts)</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
          >
            <Link href="/ingredients/usda">
              <span className="block font-medium">Wyszukaj w bazie</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Ogólny składnik (USDA)</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
            onClick={() => setMode("manual")}
          >
            <span className="block font-medium">Dodaj manualnie</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Wpisz wartości sam</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-lg">Dodaj ręcznie</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => setMode("chooser")}>
          Wstecz
        </Button>
      </CardHeader>
      <CardContent>{manualForm}</CardContent>
    </Card>
  );
}
