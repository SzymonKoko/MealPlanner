"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { switchActiveHousehold } from "@/modules/households/actions/switch-active-household";

interface HouseholdOption {
  id: string;
  name: string;
}

interface HouseholdSwitcherProps {
  households: HouseholdOption[];
  activeHouseholdId: string | null;
}

export function HouseholdSwitcher({ households, activeHouseholdId }: HouseholdSwitcherProps) {
  const router = useRouter();

  if (households.length === 0) return null;

  return (
    <Select
      value={activeHouseholdId ?? undefined}
      onValueChange={async (value) => {
        await switchActiveHousehold(value);
        router.refresh();
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Wybierz gospodarstwo" />
      </SelectTrigger>
      <SelectContent>
        {households.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
