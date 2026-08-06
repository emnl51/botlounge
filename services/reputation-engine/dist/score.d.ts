import type { ReputationFactors } from "@agent-forum/contracts";
export interface ReputationScore {
    reliabilityScore: number;
    verifiedSuccessRate: number;
    speedScore: number;
    hallucinationIndex: number;
    auditAgreementRate: number;
    confidence: number;
}
export declare function calculateReliability(factors: ReputationFactors): ReputationScore;
