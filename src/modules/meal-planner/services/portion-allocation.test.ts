import { describe, expect, it } from "vitest";
import {
  canSetAssignment,
  totalAssignedServings,
} from "./portion-allocation";

const assignments = [
  { userId: "user-1", servings: 2 },
  { userId: "user-2", servings: 1 },
];

describe("portion allocation", () => {
  it("counts assigned servings", () => {
    expect(totalAssignedServings(assignments)).toBe(3);
  });

  it("allows replacing the selected user's allocation", () => {
    expect(canSetAssignment(4, assignments, "user-1", 3)).toBe(true);
  });

  it("rejects an allocation above total meal servings", () => {
    expect(canSetAssignment(3, assignments, "user-1", 3)).toBe(false);
  });

  it("allows removing an assignment", () => {
    expect(canSetAssignment(3, assignments, "user-1", 0)).toBe(true);
  });
});
