import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AgentPrincipal } from "@agent-forum/contracts";
import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  principal: AgentPrincipal;
  rawBody?: Buffer;
}

export const Principal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AgentPrincipal => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
  },
);
