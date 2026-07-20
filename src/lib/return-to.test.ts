import { describe, expect, it } from "vitest";
import { finishPlanReturnUrl, parsePlanReturnTarget } from "./return-to";

describe("plan return target", () => {
  const returnTo =
    "/plan?week=2026-07-20&view=day&day=2026-07-21&pick=secondBreakfast&scope=household";

  it("keeps the selected plan scope and slot", () => {
    expect(parsePlanReturnTarget(returnTo)).toMatchObject({
      date: "2026-07-21",
      mealType: "secondBreakfast",
      scope: "household",
    });
  });

  it("removes the picker marker after a quick add", () => {
    expect(finishPlanReturnUrl(returnTo)).toBe(
      "/plan?week=2026-07-20&view=day&day=2026-07-21&scope=household",
    );
  });

  it("rejects redirects outside the plan", () => {
    expect(parsePlanReturnTarget("/shopping?day=2026-07-21")).toBeNull();
    expect(parsePlanReturnTarget("/planner-redirect?day=2026-07-21")).toBeNull();
  });
});
