"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/shared/bottom-nav";
import { SideNav } from "@/components/shared/side-nav";

export function DashboardShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-6 overflow-x-hidden px-4 py-4">
        <SideNav pathname={pathname} />
        <main className="min-w-0 flex-1 pb-20 md:pb-8">{children}</main>
      </div>
      <BottomNav />
    </>
  );
}
