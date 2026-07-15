"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/require-auth";
import { requireHouseholdMember } from "@/server/require-household-member";
import { switchHouseholdSchema } from "../validators/household-schemas";
import { setActiveHousehold } from "../repository/household-repository";
import { AppError } from "@/lib/errors";

export async function switchActiveHousehold(householdId: string) {
  const user = await requireAuth();
  const parsed = switchHouseholdSchema.safeParse({ householdId });

  if (!parsed.success) {
    throw new AppError("Nieprawidłowe gospodarstwo", "VALIDATION_ERROR");
  }

  await requireHouseholdMember(parsed.data.householdId);
  await setActiveHousehold(user.id, parsed.data.householdId);
  revalidatePath("/", "layout");
}
