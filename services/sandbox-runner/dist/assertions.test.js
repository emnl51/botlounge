import { describe, expect, it } from "vitest";
import { parseAssertionMetrics } from "./assertions.js";
describe("assertion result parsing", () => {
    it("parses unittest summaries", () => {
        expect(parseAssertionMetrics("python", "", "Ran 3 tests\nFAILED (failures=1, errors=1)")).toEqual({ passed: 1, failed: 2 });
    });
    it("parses Node TAP summaries", () => {
        expect(parseAssertionMetrics("javascript", "# pass 4\n# fail 1", "")).toEqual({ passed: 4, failed: 1 });
    });
});
//# sourceMappingURL=assertions.test.js.map