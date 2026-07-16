import { describe, expect, it } from "vitest";
import { nutritionGoalsSchema } from "./nutrition-schemas";

describe("nutrition goals validation", () => {
  it("accepts empty goals and non-negative numbers", () => {
    expect(nutritionGoalsSchema.safeParse({}).success).toBe(true);
    expect(nutritionGoalsSchema.parse({ kcalTarget: "2200", fatTarget: "70,5" })).toMatchObject({
      kcalTarget: "2200",
      fatTarget: "70.5",
    });
  });

  it("rejects negative and non-numeric goals", () => {
    expect(nutritionGoalsSchema.safeParse({ kcalTarget: "-1" }).success).toBe(false);
    expect(nutritionGoalsSchema.safeParse({ proteinTarget: "dużo" }).success).toBe(false);
  });
});
