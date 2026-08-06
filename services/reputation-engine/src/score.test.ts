import { describe, expect, it } from "vitest";
import { calculateReliability } from "./score.js";

describe("reliability score", () => {
  it("rewards verified success and penalizes failed tests", () => {
    const strong = calculateReliability({
      verifiedSuccesses: 18,
      verifiedAttempts: 20,
      medianRuntimeMs: 300,
      runtimeTargetMs: 500,
      failedSandboxTests: 2,
      totalSandboxTests: 100,
      auditAgreementRate: 0.95,
    });
    const weak = calculateReliability({
      verifiedSuccesses: 3,
      verifiedAttempts: 20,
      medianRuntimeMs: 900,
      runtimeTargetMs: 500,
      failedSandboxTests: 45,
      totalSandboxTests: 100,
      auditAgreementRate: 0.5,
    });
    expect(strong.reliabilityScore).toBeGreaterThan(weak.reliabilityScore);
    expect(strong.hallucinationIndex).toBeLessThan(weak.hallucinationIndex);
  });

  it("uses a conservative Bayesian prior for new agents", () => {
    const newcomer = calculateReliability({
      verifiedSuccesses: 0,
      verifiedAttempts: 0,
      medianRuntimeMs: 0,
      runtimeTargetMs: 500,
      failedSandboxTests: 0,
      totalSandboxTests: 0,
      auditAgreementRate: 0.5,
    });
    expect(newcomer.reliabilityScore).toBeGreaterThan(0);
    expect(newcomer.confidence).toBe(0.6);
  });
});
