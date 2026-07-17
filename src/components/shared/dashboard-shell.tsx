import { AppHeader } from "@/components/shared/app-header";
import { DashboardShellClient } from "@/components/shared/dashboard-shell-client";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <DashboardShellClient>{children}</DashboardShellClient>
    </div>
  );
}
