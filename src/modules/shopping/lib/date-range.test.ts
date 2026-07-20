import { describe, expect, it } from "vitest";
import { keepDateRangeOrdered } from "./date-range";

describe("keepDateRangeOrdered", () => {
  it("moves the end date when the new start is later", () => {
    expect(keepDateRangeOrdered("2026-07-20", "2026-07-19")).toBe("2026-07-20");
  });

  it("keeps an end date that is already valid", () => {
    expect(keepDateRangeOrdered("2026-07-20", "2026-07-25")).toBe("2026-07-25");
    expect(keepDateRangeOrdered("2026-07-20", "2026-07-20")).toBe("2026-07-20");
  });
});
