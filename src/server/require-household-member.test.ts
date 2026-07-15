import { hasMinimumRole } from "@/modules/households/services/role-checks";
import { describe, it, expect } from "vitest";

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
});
