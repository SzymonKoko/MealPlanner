import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireAuth } from "@/server/require-auth";
import { requireActiveHousehold } from "@/server/require-household-member";
import {
  listUserHouseholds,
  getHouseholdMembers,
  getHouseholdInvites,
} from "@/modules/households/repository/household-repository";
import { getNutritionGoals } from "@/modules/nutrition/repository/nutrition-repository";
import { saveNutritionGoalsAction } from "@/modules/nutrition/actions/nutrition-actions";
import { inviteMember, createHousehold } from "@/modules/households/actions/household-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function MorePage() {
  const user = await requireAuth();
  const households = await listUserHouseholds(user.id);

  let members: Awaited<ReturnType<typeof getHouseholdMembers>> = [];
  let invites: Awaited<ReturnType<typeof getHouseholdInvites>> = [];
  let goals = null;
  let activeHouseholdId: string | null = user.activeHouseholdId;

  if (activeHouseholdId) {
    try {
      const ctx = await requireActiveHousehold();
      [members, invites, goals] = await Promise.all([
        getHouseholdMembers(ctx.householdId),
        getHouseholdInvites(ctx.householdId),
        getNutritionGoals(user.id),
      ]);
    } catch {
      activeHouseholdId = null;
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Więcej</h1>

        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{user.displayName}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </CardContent>
        </Card>

        {households.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Utwórz gospodarstwo</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createHousehold} className="flex gap-2">
                <Input name="name" placeholder="Nazwa" required />
                <Button type="submit">Utwórz</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {activeHouseholdId ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Cele żywieniowe</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={saveNutritionGoalsAction} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kcalTarget">Kalorie</Label>
                    <Input id="kcalTarget" name="kcalTarget" type="number" defaultValue={goals?.kcalTarget ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proteinTarget">Białko (g)</Label>
                    <Input id="proteinTarget" name="proteinTarget" type="number" defaultValue={goals?.proteinTarget ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbsTarget">Węglowodany (g)</Label>
                    <Input id="carbsTarget" name="carbsTarget" type="number" defaultValue={goals?.carbsTarget ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatTarget">Tłuszcze (g)</Label>
                    <Input id="fatTarget" name="fatTarget" type="number" defaultValue={goals?.fatTarget ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiberTarget">Błonnik (g)</Label>
                    <Input id="fiberTarget" name="fiberTarget" type="number" defaultValue={goals?.fiberTarget ?? ""} />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit">Zapisz cele</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Członkowie gospodarstwa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {members.map((m) => (
                  <div key={m.userId} className="flex justify-between rounded-lg border p-3 text-sm">
                    <span>{m.displayName}</span>
                    <span className="text-muted-foreground">{m.role}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Zaproś członka</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={inviteMember} className="flex flex-wrap gap-2">
                  <input type="hidden" name="householdId" value={activeHouseholdId} />
                  <Input name="email" type="email" placeholder="Email (opcjonalnie)" className="flex-1" />
                  <select name="role" className="h-11 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="member">member</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <Button type="submit">Utwórz link</Button>
                </form>
                {invites.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Aktywne zaproszenia</p>
                    {invites.map((inv) => (
                      <p key={inv.id} className="text-sm text-muted-foreground">
                        <Link href={`/invite/${inv.token}`} className="underline">
                          Link zaproszenia
                        </Link>{" "}
                        ({inv.role}) — ważne do {inv.expiresAt.toLocaleDateString("pl-PL")}
                      </p>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Nawigacja</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/ingredients" className="text-primary underline">
              Składniki i produkty
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

