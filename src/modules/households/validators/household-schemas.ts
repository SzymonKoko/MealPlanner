import { z } from "zod";

export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana").max(100),
});

export const inviteMemberSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().email("Podaj prawidłowy adres e-mail"),
  role: z.enum(["member", "viewer"]).default("member"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export const switchHouseholdSchema = z.object({
  householdId: z.string().uuid(),
});
