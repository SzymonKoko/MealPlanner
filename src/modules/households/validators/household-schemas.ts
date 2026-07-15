import { z } from "zod";
import { householdRoleEnum } from "@/db/schema/households";

export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana").max(100),
});

export const inviteMemberSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(householdRoleEnum).default("member"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export const switchHouseholdSchema = z.object({
  householdId: z.string().uuid(),
});
