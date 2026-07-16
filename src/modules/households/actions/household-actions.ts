"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { addDays } from "date-fns";
import { requireAuth } from "@/server/require-auth";
import {
  requireHouseholdMember,
  requireHouseholdOwner,
} from "@/server/require-household-member";
import { createHouseholdSchema, inviteMemberSchema, acceptInviteSchema } from "../validators/household-schemas";
import {
  createHouseholdRecord,
  createInvite,
  getInviteByToken,
  acceptInviteRecord,
  getMembership,
  renameHousehold,
  updateMembershipRole,
  removeHouseholdMember,
  revokeInvite,
  transferHouseholdOwnership,
} from "../repository/household-repository";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const uuidSchema = z.string().uuid();

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

  const { user } = await requireHouseholdOwner(parsed.data.householdId);
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

  if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new AppError("Zaproszenie jest przypisane do innego adresu e-mail", "FORBIDDEN", 403);
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

export async function renameHouseholdAction(formData: FormData) {
  const householdId = formData.get("householdId");
  const parsed = createHouseholdSchema.safeParse({ name: formData.get("name") });
  const parsedHouseholdId = uuidSchema.safeParse(householdId);
  if (!parsedHouseholdId.success || !parsed.success) {
    throw new AppError("Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  await requireHouseholdOwner(parsedHouseholdId.data);
  await renameHousehold(parsedHouseholdId.data, parsed.data.name);
  revalidatePath("/", "layout");
}

export async function updateMemberRoleAction(formData: FormData) {
  const householdId = formData.get("householdId");
  const userId = formData.get("userId");
  const role = formData.get("role");
  const parsedHouseholdId = uuidSchema.safeParse(householdId);
  const parsedUserId = uuidSchema.safeParse(userId);
  if (!parsedHouseholdId.success || !parsedUserId.success || (role !== "member" && role !== "viewer")) {
    throw new AppError("Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  await requireHouseholdOwner(parsedHouseholdId.data);
  const membership = await getMembership(parsedHouseholdId.data, parsedUserId.data);
  if (!membership || membership.role === "owner") {
    throw new AppError("Nie można zmienić roli właściciela", "FORBIDDEN", 403);
  }
  await updateMembershipRole(parsedHouseholdId.data, parsedUserId.data, role);
  revalidatePath("/more");
}

export async function removeMemberAction(formData: FormData) {
  const householdId = formData.get("householdId");
  const userId = formData.get("userId");
  const parsedHouseholdId = uuidSchema.safeParse(householdId);
  const parsedUserId = uuidSchema.safeParse(userId);
  if (!parsedHouseholdId.success || !parsedUserId.success) {
    throw new AppError("Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  await requireHouseholdOwner(parsedHouseholdId.data);
  const membership = await getMembership(parsedHouseholdId.data, parsedUserId.data);
  if (!membership || membership.role === "owner") {
    throw new AppError("Nie można usunąć właściciela", "FORBIDDEN", 403);
  }
  await removeHouseholdMember(parsedHouseholdId.data, parsedUserId.data);
  revalidatePath("/more");
}

export async function revokeInviteAction(formData: FormData) {
  const householdId = formData.get("householdId");
  const inviteId = formData.get("inviteId");
  const parsedHouseholdId = uuidSchema.safeParse(householdId);
  const parsedInviteId = uuidSchema.safeParse(inviteId);
  if (!parsedHouseholdId.success || !parsedInviteId.success) {
    throw new AppError("Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  await requireHouseholdOwner(parsedHouseholdId.data);
  if (!(await revokeInvite(parsedHouseholdId.data, parsedInviteId.data))) {
    throw new AppError("Zaproszenie nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/more");
}

export async function leaveHouseholdAction(formData: FormData) {
  const parsedHouseholdId = uuidSchema.safeParse(formData.get("householdId"));
  if (!parsedHouseholdId.success) {
    throw new AppError("Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  const context = await requireHouseholdMember(parsedHouseholdId.data);
  if (context.role === "owner") {
    throw new AppError("Właściciel nie może opuścić gospodarstwa", "FORBIDDEN", 403);
  }
  await removeHouseholdMember(parsedHouseholdId.data, context.user.id);
  revalidatePath("/", "layout");
  redirect("/more");
}

export async function transferOwnershipAction(formData: FormData) {
  const parsedHouseholdId = uuidSchema.safeParse(formData.get("householdId"));
  const parsedUserId = uuidSchema.safeParse(formData.get("userId"));
  if (!parsedHouseholdId.success || !parsedUserId.success) {
    throw new AppError("Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  const context = await requireHouseholdOwner(parsedHouseholdId.data);
  if (context.user.id === parsedUserId.data) {
    throw new AppError("Już jesteś właścicielem", "VALIDATION_ERROR");
  }
  const membership = await getMembership(parsedHouseholdId.data, parsedUserId.data);
  if (!membership) throw new AppError("Użytkownik nie jest członkiem gospodarstwa", "NOT_FOUND", 404);
  await transferHouseholdOwnership(
    parsedHouseholdId.data,
    context.user.id,
    parsedUserId.data,
  );
  revalidatePath("/", "layout");
  redirect("/more");
}
