import { describe, expect, it } from "vitest";
import { inviteMemberSchema } from "./household-schemas";

const householdId = "11111111-1111-4111-8111-111111111111";

describe("inviteMemberSchema", () => {
  it("allows member and viewer invitations", () => {
    expect(inviteMemberSchema.safeParse({ householdId, role: "member" }).success).toBe(true);
    expect(inviteMemberSchema.safeParse({ householdId, role: "viewer" }).success).toBe(true);
  });

  it("does not allow granting owner through an invitation", () => {
    expect(inviteMemberSchema.safeParse({ householdId, role: "owner" }).success).toBe(false);
  });
});
