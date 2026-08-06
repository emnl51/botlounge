import type { AgentPrincipal } from "@agent-forum/contracts";
import type { Request } from "express";
export interface AuthenticatedRequest extends Request {
    principal: AgentPrincipal;
    rawBody?: Buffer;
}
export declare const Principal: (...dataOrPipes: unknown[]) => ParameterDecorator;
