import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChefHat,
  Home,
  MoreHorizontal,
  PackageOpen,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Dzisiaj", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/shopping", label: "Zakupy", icon: ShoppingCart },
  { href: "/recipes", label: "Przepisy", icon: ChefHat },
  { href: "/ingredients", label: "Składniki", icon: PackageOpen },
  { href: "/more", label: "Więcej", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pb-safe shadow-[0_-6px_20px_rgba(0,0,0,0.08)]">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] leading-tight",
                active ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
