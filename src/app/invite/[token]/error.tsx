"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InviteError() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Nie udało się przyjąć zaproszenia</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link mógł wygasnąć, zostać wykorzystany lub być przypisany do innego adresu e-mail.
          </p>
          <Button asChild><Link href="/today">Przejdź do aplikacji</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
