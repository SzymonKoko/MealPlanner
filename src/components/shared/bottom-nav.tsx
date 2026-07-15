import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChefHat, Home, MoreHorizontal, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Dzisiaj", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/shopping", label: "Zakupy", icon: ShoppingCart },
  { href: "/recipes", label: "Przepisy", icon: ChefHat },
  { href: "/more", label: "Więcej", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-safe">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 px-2 py-2 text-xs",
                active ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
