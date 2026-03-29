import { describe, it, expect } from "vitest";
import { formatTimestamp } from "../format";

describe("formatTimestamp", () => {
  it("formats 0 seconds as 00:00", () => {
    expect(formatTimestamp(0)).toBe("00:00");
  });

  it("formats 65 seconds as 01:05", () => {
    expect(formatTimestamp(65)).toBe("01:05");
  });

  it("formats 3661 seconds as 61:01", () => {
    expect(formatTimestamp(3661)).toBe("61:01");
  });

  it("formats fractional seconds by flooring", () => {
    expect(formatTimestamp(65.9)).toBe("01:05");
  });
});
