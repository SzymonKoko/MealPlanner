"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shared/app-header";
import { BottomNav } from "@/components/shared/bottom-nav";
import { SideNav } from "@/components/shared/side-nav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4">
        <SideNav pathname={pathname} />
        <main className="min-h-[calc(100vh-8rem)] flex-1 pb-24 md:pb-8">{children}</main>
      </div>
      <BottomNav />
    </>
  );
}
