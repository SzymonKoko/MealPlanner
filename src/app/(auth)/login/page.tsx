import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeInternalRedirect } from "@/lib/redirects";

const isDevBypass =
  process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeInternalRedirect(params.callbackUrl);
  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>MealPlanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.AUTHENTIK_ISSUER &&
          process.env.AUTHENTIK_CLIENT_ID &&
          process.env.AUTHENTIK_CLIENT_SECRET ? (
            <form
              action={async () => {
                "use server";
                await signIn("authentik", { redirectTo: callbackUrl });
              }}
            >
              <Button type="submit" className="w-full">
                Zaloguj przez Authentik
              </Button>
            </form>
          ) : null}

          {isDevBypass ? (
            <form
              action={async (formData) => {
                "use server";
                await signIn("dev-bypass", {
                  email: formData.get("email") as string,
                  name: formData.get("name") as string,
                  redirectTo: callbackUrl,
                });
              }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">Tryb deweloperski (DEV_AUTH_BYPASS)</p>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required defaultValue="dev@local.test" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nazwa</Label>
                <Input id="name" name="name" defaultValue="Dev User" />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                Zaloguj (dev)
              </Button>
            </form>
          ) : null}

          {!isDevBypass &&
          (!process.env.AUTHENTIK_ISSUER ||
            !process.env.AUTHENTIK_CLIENT_ID ||
            !process.env.AUTHENTIK_CLIENT_SECRET) ? (
            <p className="text-sm text-destructive">
              Brak konfiguracji AUTHENTIK_* lub AUTH_SECRET/AUTH_URL w .env
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
