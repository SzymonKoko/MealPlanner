import { AppHeader } from "@/components/shared/app-header";
import { DashboardShellClient } from "@/components/shared/dashboard-shell-client";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <DashboardShellClient>{children}</DashboardShellClient>
    </>
  );
}
