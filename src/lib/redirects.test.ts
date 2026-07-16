import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "./redirects";

describe("safeInternalRedirect", () => {
  it("keeps internal application paths", () => {
    expect(safeInternalRedirect("/invite/token")).toBe("/invite/token");
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeInternalRedirect("https://evil.example")).toBe("/today");
    expect(safeInternalRedirect("//evil.example")).toBe("/today");
  });
});
