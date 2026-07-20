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
import {
  inviteMember,
  createHousehold,
  renameHouseholdAction,
  updateMemberRoleAction,
  removeMemberAction,
  revokeInviteAction,
  updateInviteRoleAction,
  leaveHouseholdAction,
  transferOwnershipAction,
} from "@/modules/households/actions/household-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PwaInstallButton } from "@/components/shared/pwa-install-button";
import { FeedbackForm } from "@/components/shared/feedback-form";
import { CopyInviteLinkButton } from "@/modules/households/components/copy-invite-link-button";

export default async function MorePage() {
  const user = await requireAuth();
  const households = await listUserHouseholds(user.id);

  let members: Awaited<ReturnType<typeof getHouseholdMembers>> = [];
  let invites: Awaited<ReturnType<typeof getHouseholdInvites>> = [];
  let goals = null;
  let activeHouseholdId: string | null = user.activeHouseholdId;
  let activeRole: "owner" | "member" | "viewer" | null = null;

  if (activeHouseholdId) {
    try {
      const ctx = await requireActiveHousehold();
      activeRole = ctx.role;
      [members, goals] = await Promise.all([
        getHouseholdMembers(ctx.householdId),
        getNutritionGoals(user.id),
      ]);
      if (ctx.role === "owner") {
        invites = await getHouseholdInvites(ctx.householdId);
      }
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
            <div className="pt-3"><PwaInstallButton /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Utwórz kolejne gospodarstwo</CardTitle></CardHeader>
          <CardContent>
            <form action={createHousehold} className="flex gap-2">
              <Input name="name" placeholder="Nazwa" required />
              <Button type="submit">Utwórz</Button>
            </form>
          </CardContent>
        </Card>

        {activeHouseholdId ? (
          <>
            {activeRole === "owner" ? (
              <Card>
                <CardHeader><CardTitle>Ustawienia gospodarstwa</CardTitle></CardHeader>
                <CardContent>
                  <form action={renameHouseholdAction} className="flex gap-2">
                    <input type="hidden" name="householdId" value={activeHouseholdId} />
                    <Input
                      name="name"
                      defaultValue={households.find((item) => item.id === activeHouseholdId)?.name}
                      required
                    />
                    <Button type="submit">Zmień nazwę</Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
            {activeRole && activeRole !== "owner" ? (
              <Card>
                <CardHeader><CardTitle>Członkostwo</CardTitle></CardHeader>
                <CardContent>
                  <form action={leaveHouseholdAction}>
                    <input type="hidden" name="householdId" value={activeHouseholdId} />
                    <Button type="submit" variant="destructive">Opuść gospodarstwo</Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>Cele żywieniowe</CardTitle>
              </CardHeader>
              <CardContent>
                <FeedbackForm action={saveNutritionGoalsAction} successMessage="Zapisano cele żywieniowe" className="grid gap-3 sm:grid-cols-2">
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
                </FeedbackForm>
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
                    {activeRole === "owner" && m.role !== "owner" ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={updateMemberRoleAction} className="flex gap-2">
                          <input type="hidden" name="householdId" value={activeHouseholdId} />
                          <input type="hidden" name="userId" value={m.userId} />
                          <select name="role" defaultValue={m.role} className="h-11 rounded-lg border bg-background px-2">
                            <option value="member">member</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <Button type="submit" size="sm">Zapisz</Button>
                        </form>
                        <form action={removeMemberAction}>
                          <input type="hidden" name="householdId" value={activeHouseholdId} />
                          <input type="hidden" name="userId" value={m.userId} />
                          <Button type="submit" size="sm" variant="ghost" className="text-destructive">Usuń</Button>
                        </form>
                      <form action={transferOwnershipAction}>
                        <input type="hidden" name="householdId" value={activeHouseholdId} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <Button type="submit" size="sm" variant="outline">Przekaż własność</Button>
                      </form>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{m.role}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {activeRole === "owner" ? <Card>
              <CardHeader>
                <CardTitle>Zaproś członka</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={inviteMember} className="flex flex-wrap gap-2">
                  <input type="hidden" name="householdId" value={activeHouseholdId} />
                  <Input name="email" type="email" placeholder="Email" className="flex-1" required />
                  <select name="role" className="h-11 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="member">member</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <Button type="submit">Zaproś</Button>
                </form>
                {invites.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Aktywne zaproszenia</p>
                    {invites.map((inv) => (
                      <div key={inv.id} className="space-y-2 rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium text-foreground">
                            {inv.email ?? "Link bez e-maila"} <span className="font-normal text-muted-foreground">(oczekujące)</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ważne do {inv.expiresAt.toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyInviteLinkButton link={`${process.env.APP_URL ?? ""}/invite/${inv.token}`} />
                          <FeedbackForm
                            action={updateInviteRoleAction}
                            successMessage="Zmieniono uprawnienia zaproszenia"
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="householdId" value={activeHouseholdId} />
                            <input type="hidden" name="inviteId" value={inv.id} />
                            <select
                              name="role"
                              defaultValue={inv.role}
                              aria-label={`Uprawnienia zaproszenia ${inv.email ?? ""}`}
                              className="h-9 rounded-lg border bg-background px-2 text-sm"
                            >
                              <option value="member">member</option>
                              <option value="viewer">viewer</option>
                            </select>
                            <Button type="submit" size="sm" variant="secondary">Uprawnienia</Button>
                          </FeedbackForm>
                          <FeedbackForm
                            action={revokeInviteAction}
                            successMessage="Usunięto zaproszenie"
                          >
                            <input type="hidden" name="householdId" value={activeHouseholdId} />
                            <input type="hidden" name="inviteId" value={inv.id} />
                            <Button type="submit" size="sm" variant="ghost" className="text-destructive">Usuń</Button>
                          </FeedbackForm>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card> : null}
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
