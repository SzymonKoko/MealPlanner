import Link from "next/link";
import { requireAuth } from "@/server/require-auth";
import { listUserHouseholds } from "@/modules/households/repository/household-repository";
import { signOutAction } from "@/modules/auth/actions/sign-out";
import { HouseholdSwitcher } from "./household-switcher";
import { Button } from "@/components/ui/button";

export async function AppHeader() {
  const user = await requireAuth();
  const households = await listUserHouseholds(user.id);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/today" className="text-lg font-semibold">
          MealPlanner
        </Link>
        <div className="flex items-center gap-3">
          <HouseholdSwitcher households={households} activeHouseholdId={user.activeHouseholdId} />
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.displayName}</span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Wyloguj
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
