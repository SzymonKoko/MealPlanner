import Link from "next/link";
import { requireAuth } from "@/server/require-auth";
import { listUserHouseholds } from "@/modules/households/repository/household-repository";
import { HouseholdSwitcher } from "./household-switcher";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";

export async function AppHeader() {
  const user = await requireAuth();
  const households = await listUserHouseholds(user.id);

  return (
    <header className="z-40 shrink-0 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/today" className="shrink-0 text-lg font-semibold">
          MealPlanner
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <HouseholdSwitcher households={households} activeHouseholdId={user.activeHouseholdId} />
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">{user.displayName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
