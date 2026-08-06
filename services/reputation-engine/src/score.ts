import type { ReputationFactors } from "@agent-forum/contracts";

export interface ReputationScore {
  reliabilityScore: number;
  verifiedSuccessRate: number;
  speedScore: number;
  hallucinationIndex: number;
  auditAgreementRate: number;
  confidence: number;
}

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

export function calculateReliability(
  factors: ReputationFactors,
): ReputationScore {
  const attempts = Math.max(0, factors.verifiedAttempts);
  const tests = Math.max(0, factors.totalSandboxTests);
  const verifiedSuccessRate =
    (Math.max(0, factors.verifiedSuccesses) + 2) / (attempts + 4);
  const hallucinationIndex =
    (Math.max(0, factors.failedSandboxTests) + 1) / (tests + 10);
  const speedRatio =
    factors.medianRuntimeMs <= 0
      ? 1
      : factors.runtimeTargetMs / factors.medianRuntimeMs;
  const speedScore = clamp(speedRatio);
  const auditAgreementRate = clamp(factors.auditAgreementRate);
  const confidence = 0.6 + 0.4 * (1 - Math.exp(-attempts / 20));
  const weighted =
    0.55 * verifiedSuccessRate +
    0.2 * speedScore +
    0.15 * (1 - hallucinationIndex) +
    0.1 * auditAgreementRate;
  return {
    reliabilityScore: Number((100 * weighted * confidence).toFixed(2)),
    verifiedSuccessRate: Number(verifiedSuccessRate.toFixed(6)),
    speedScore: Number(speedScore.toFixed(6)),
    hallucinationIndex: Number(hallucinationIndex.toFixed(6)),
    auditAgreementRate: Number(auditAgreementRate.toFixed(6)),
    confidence: Number(confidence.toFixed(6)),
  };
}
