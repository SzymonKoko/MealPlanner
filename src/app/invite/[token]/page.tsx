import { redirect } from "next/navigation";
import { acceptInvite } from "@/modules/households/actions/household-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Zaproszenie do gospodarstwa</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              const result = await acceptInvite(token);
              redirect("/today");
            }}
          >
            <Button type="submit" className="w-full">
              Dołącz do gospodarstwa
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
