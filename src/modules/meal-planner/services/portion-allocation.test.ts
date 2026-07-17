import { describe, expect, it } from "vitest";
import {
  equalShares,
  percentageAllocationsToShares,
  personalAmount,
  validateShares,
} from "./portion-allocation";

describe("meal plan shares", () => {
  it("splits an entry equally between two distinct people", () => {
    expect(equalShares(["user-1", "user-2"])).toEqual([
      { userId: "user-1", share: 0.5 },
      { userId: "user-2", share: 0.5 },
    ]);
  });

  it("converts a custom 65/35 percentage split to shares", () => {
    expect(
      percentageAllocationsToShares([
        { userId: "user-1", percentage: 65 },
        { userId: "user-2", percentage: 35 },
      ]),
    ).toEqual([
      { userId: "user-1", share: 0.65 },
      { userId: "user-2", share: 0.35 },
    ]);
  });

  it("keeps a 65/35 split when total servings change from 4 to 6", () => {
    expect(personalAmount(6, 0.65)).toBeCloseTo(3.9);
    expect(personalAmount(6, 0.35)).toBeCloseTo(2.1);
  });

  it("rejects duplicate people and totals other than 100%", () => {
    expect(() =>
      validateShares([
        { userId: "user-1", share: 0.5 },
        { userId: "user-1", share: 0.5 },
      ]),
    ).toThrow("Każdy domownik może wystąpić tylko raz");

    expect(() => validateShares([{ userId: "user-1", share: 0.65 }])).toThrow(
      "Suma udziałów musi wynosić 100%",
    );
  });
});
