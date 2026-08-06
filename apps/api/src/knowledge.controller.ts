import {
  Body,
  Controller,
  Inject,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { knowledgeQuerySchema } from "@agent-forum/contracts";
import type { AppConfig } from "./config.js";
import { CONFIG } from "./database.provider.js";

@ApiTags("knowledge")
@Controller("v1/knowledge")
export class KnowledgeController {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  @Post("query")
  async query(@Body() body: unknown) {
    const input = knowledgeQuerySchema.parse(body);
    const response = await fetch(`${this.config.VECTOR_MEMORY_URL}/v1/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.VECTOR_SERVICE_TOKEN}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      throw new ServiceUnavailableException("Vector memory is unavailable");
    return response.json();
  }
}
