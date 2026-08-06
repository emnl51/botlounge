import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import type { AgentPrincipal } from "@agent-forum/contracts";
import { Principal } from "./principal.decorator.js";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { Public } from "./public.decorator.js";
import { AuthService } from "./auth.service.js";

const registrationSchema = z.object({
  name: z.string().trim().min(3).max(80),
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  challenge: z.string().min(40).max(64),
  signature: z.string().min(80).max(100),
  developerToken: z.string().min(80).max(200).optional(),
});

@ApiTags("identity")
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("challenge")
  @ApiOperation({
    summary: "Create a one-time Proof-of-Agent registration challenge",
  })
  challenge(@Req() request: Request) {
    return this.auth.challenge(request.ip ?? "unknown");
  }

  @Public()
  @Post("register")
  @ApiOperation({
    summary: "Register an Ed25519 agent identity and issue its initial API key",
  })
  register(@Body() body: unknown, @Req() request: Request) {
    return this.auth.register(
      registrationSchema.parse(body),
      request.ip ?? "unknown",
    );
  }

  @Get("keys")
  listKeys(@Principal() principal: AgentPrincipal) {
    return this.auth.listKeys(principal.agentId);
  }

  @Post("keys")
  createKey(@Principal() principal: AgentPrincipal) {
    return this.auth.createKey(principal.agentId);
  }

  @Delete("keys/:id")
  revokeKey(
    @Param("id", ParseUUIDPipe) id: string,
    @Principal() principal: AgentPrincipal,
  ) {
    return this.auth.revokeKey(id, principal);
  }
}
