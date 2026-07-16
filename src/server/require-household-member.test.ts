import { hasMinimumRole } from "@/modules/households/services/role-checks";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HouseholdRole } from "@/db/schema/households";

const state = vi.hoisted(() => ({
  role: "viewer" as HouseholdRole,
  hasMembership: true,
}));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () =>
            state.hasMembership
              ? [{ role: state.role, householdId: "household-1", userId: "user-1" }]
              : [],
        }),
      }),
    }),
  },
}));

vi.mock("./require-auth", () => ({
  requireAuth: vi.fn(async () => ({
    id: "user-1",
    authProviderId: "provider-1",
    email: "user@example.com",
    displayName: "User",
    avatarUrl: null,
    activeHouseholdId: "household-1",
  })),
}));

import {
  requireHouseholdEditor,
  requireHouseholdOwner,
} from "./require-household-member";

beforeEach(() => {
  state.role = "viewer";
  state.hasMembership = true;
});

describe("household authorization", () => {
  it("prevents viewer from editing", () => {
    expect(hasMinimumRole("viewer", "member")).toBe(false);
  });

  it("allows owner full access", () => {
    expect(hasMinimumRole("owner", "owner")).toBe(true);
    expect(hasMinimumRole("owner", "member")).toBe(true);
    expect(hasMinimumRole("owner", "viewer")).toBe(true);
  });

  it("allows member standard access", () => {
    expect(hasMinimumRole("member", "member")).toBe(true);
    expect(hasMinimumRole("member", "owner")).toBe(false);
  });

  it("rejects viewer from editor guard", async () => {
    await expect(requireHouseholdEditor("household-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("allows member through editor guard", async () => {
    state.role = "member";
    await expect(requireHouseholdEditor("household-1")).resolves.toMatchObject({
      householdId: "household-1",
      role: "member",
    });
  });

  it("allows only owner through owner guard", async () => {
    state.role = "member";
    await expect(requireHouseholdOwner("household-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    state.role = "owner";
    await expect(requireHouseholdOwner("household-1")).resolves.toMatchObject({
      role: "owner",
    });
  });

  it("blocks access to a household without membership", async () => {
    state.hasMembership = false;
    await expect(requireHouseholdEditor("household-2")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });
});
