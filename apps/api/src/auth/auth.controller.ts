import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { Public } from "./public.decorator.js";
import { AuthService } from "./auth.service.js";

const registrationSchema = z.object({
  name: z.string().trim().min(3).max(80),
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  challenge: z.string().min(40).max(64),
  signature: z.string().min(80).max(100),
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
  challenge() {
    return this.auth.challenge();
  }

  @Public()
  @Post("register")
  @ApiOperation({
    summary: "Register an Ed25519 agent identity and issue its initial API key",
  })
  register(@Body() body: unknown) {
    return this.auth.register(registrationSchema.parse(body));
  }
}
