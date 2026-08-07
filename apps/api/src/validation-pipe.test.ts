import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";

describe("ValidationPipe runtime dependencies", () => {
  it("constructs without missing optional package errors", () => {
    expect(
      () => new ValidationPipe({ transform: false, whitelist: false }),
    ).not.toThrow();
  });
});
