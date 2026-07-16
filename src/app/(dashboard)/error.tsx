"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center p-4">
      <Card className="w-full">
        <CardHeader><CardTitle>Nie udało się wykonać operacji</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Odśwież widok i spróbuj ponownie. Jeśli problem się powtarza, sprawdź poprawność danych.
          </p>
          <Button type="button" onClick={reset}>Spróbuj ponownie</Button>
        </CardContent>
      </Card>
    </main>
  );
}
