import Link from "next/link";
import { CalendarDays, ChefHat, Home, MoreHorizontal, PackageOpen, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Dzisiaj", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/shopping", label: "Zakupy", icon: ShoppingCart },
  { href: "/recipes", label: "Przepisy", icon: ChefHat },
  { href: "/ingredients", label: "Składniki", icon: PackageOpen },
  { href: "/more", label: "Więcej", icon: MoreHorizontal },
];

interface SideNavProps {
  pathname: string;
}

export function SideNav({ pathname }: SideNavProps) {
  return (
    <nav className="hidden w-44 shrink-0 self-start sticky top-0 md:block">
      <ul className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
