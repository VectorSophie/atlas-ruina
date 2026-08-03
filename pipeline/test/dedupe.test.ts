import { describe, it, expect, vi, afterEach } from "vitest";
import { dedupeById } from "../src/dedupe.js";

interface Item {
  id: string;
  value: string;
}

describe("dedupeById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns records unchanged when all ids are unique", () => {
    const items: Item[] = [
      { id: "1", value: "a" },
      { id: "2", value: "b" },
    ];
    expect(dedupeById(items, "test")).toEqual(items);
  });

  it("keeps the first occurrence and drops later duplicates by id", () => {
    const items: Item[] = [
      { id: "1", value: "first" },
      { id: "1", value: "second" },
      { id: "2", value: "only" },
    ];
    expect(dedupeById(items, "test")).toEqual([
      { id: "1", value: "first" },
      { id: "2", value: "only" },
    ]);
  });

  it("warns when duplicate records for the same id are not identical", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items: Item[] = [
      { id: "1", value: "first" },
      { id: "1", value: "different" },
    ];
    dedupeById(items, "test");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[test] Duplicate id \"1\" with differing content")
    );
  });

  it("does not warn when duplicate records for the same id are identical", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items: Item[] = [
      { id: "1", value: "same" },
      { id: "1", value: "same" },
    ];
    dedupeById(items, "test");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
