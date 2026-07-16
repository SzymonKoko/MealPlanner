"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/auth/actions/sign-out";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          if ("caches" in window) {
            await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
          }
          for (let index = localStorage.length - 1; index >= 0; index--) {
            const key = localStorage.key(index);
            if (key?.startsWith("mealplanner-")) localStorage.removeItem(key);
          }
          await signOutAction();
        });
      }}
    >
      {pending ? "Wylogowywanie..." : "Wyloguj"}
    </Button>
  );
}
