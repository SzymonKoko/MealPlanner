import { acceptInviteFormAction } from "@/modules/households/actions/household-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getInvitePreview } from "@/modules/households/repository/household-repository";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }
  const invite = await getInvitePreview(token);
  const available = Boolean(invite && invite.expiresAt > new Date());

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Zaproszenie do gospodarstwa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {available ? (
            <p className="text-sm text-muted-foreground">
              Dołączasz do: <strong className="text-foreground">{invite?.householdName}</strong> jako {invite?.role}.
            </p>
          ) : (
            <p className="text-sm text-destructive">Zaproszenie nie istnieje albo wygasło.</p>
          )}
          {available ? <form action={acceptInviteFormAction}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" className="w-full">
              Dołącz do gospodarstwa
            </Button>
          </form> : null}
        </CardContent>
      </Card>
    </div>
  );
}
