"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { addDays } from "date-fns";
import { requireAuth } from "@/server/require-auth";
import { requireHouseholdEditor } from "@/server/require-household-member";
import { createHouseholdSchema, inviteMemberSchema, acceptInviteSchema } from "../validators/household-schemas";
import {
  createHouseholdRecord,
  createInvite,
  getInviteByToken,
  acceptInviteRecord,
} from "../repository/household-repository";
import { AppError } from "@/lib/errors";

export async function createHousehold(formData: FormData) {
  const user = await requireAuth();
  const parsed = createHouseholdSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await createHouseholdRecord(parsed.data.name, user.id);
  revalidatePath("/", "layout");
}

export async function inviteMember(formData: FormData) {
  const parsed = inviteMemberSchema.safeParse({
    householdId: formData.get("householdId"),
    email: formData.get("email") || undefined,
    role: formData.get("role") || "member",
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const { user } = await requireHouseholdEditor(parsed.data.householdId);
  const token = uuidv4();
  await createInvite(
    parsed.data.householdId,
    user.id,
    token,
    addDays(new Date(), 7),
    parsed.data.role,
    parsed.data.email,
  );

  revalidatePath("/more");
}

export async function acceptInvite(token: string) {
  const user = await requireAuth();
  const parsed = acceptInviteSchema.safeParse({ token });

  if (!parsed.success) {
    throw new AppError("Nieprawidłowy token zaproszenia", "VALIDATION_ERROR");
  }

  const invite = await getInviteByToken(parsed.data.token);
  if (!invite) {
    throw new AppError("Zaproszenie nie istnieje", "NOT_FOUND", 404);
  }

  if (invite.expiresAt < new Date()) {
    throw new AppError("Zaproszenie wygasło", "EXPIRED", 410);
  }

  await acceptInviteRecord(invite.id, invite.householdId, user.id, invite.role);
  revalidatePath("/", "layout");
}

export async function acceptInviteAction(token: string) {
  await acceptInvite(token);
  redirect("/today");
}

export async function acceptInviteFormAction(formData: FormData) {
  const token = formData.get("token");
  if (!token || typeof token !== "string") {
    throw new AppError("Brak tokenu zaproszenia", "VALIDATION_ERROR");
  }
  await acceptInviteAction(token);
}
