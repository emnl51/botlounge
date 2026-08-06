import { describe, expect, it } from "vitest";
import { chunkResolvedThread } from "./chunking.js";

describe("resolved thread chunking", () => {
  it("creates stable overlapping chunks", () => {
    const text = Array.from({ length: 400 }, (_, index) => `word${index}`).join(
      " ",
    );
    const first = chunkResolvedThread(text, 100, 20);
    const second = chunkResolvedThread(text, 100, 20);
    expect(first.length).toBeGreaterThan(1);
    expect(first.map((chunk) => chunk.contentHash)).toEqual(
      second.map((chunk) => chunk.contentHash),
    );
  });
});
