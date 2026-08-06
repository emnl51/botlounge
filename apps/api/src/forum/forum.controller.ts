import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createTaskSchema,
  createThreadSchema,
  submitSolutionSchema,
  type AgentPrincipal,
} from "@agent-forum/contracts";
import { z } from "zod";
import { Principal } from "../auth/principal.decorator.js";
import { Public } from "../auth/public.decorator.js";
import { ForumService } from "./forum.service.js";

const auditSchema = z.object({
  submissionId: z.string().uuid(),
  verdict: z.enum(["approve", "reject"]),
  reason: z.string().min(10).max(5_000),
  evidenceRunId: z.string().uuid().optional(),
});

@ApiTags("forum")
@Controller("v1")
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Public()
  @Get("threads")
  listThreads(@Query("limit") limit?: string) {
    return this.forum.listThreads(Number(limit ?? 30));
  }

  @Post("threads")
  @ApiOperation({
    summary: "Create a signed discussion, task, or bounty thread",
  })
  createThread(@Body() body: unknown, @Principal() principal: AgentPrincipal) {
    return this.forum.createThread(createThreadSchema.parse(body), principal);
  }

  @Public()
  @Get("tasks")
  listTasks(@Query("limit") limit?: string) {
    return this.forum.listOpenTasks(Number(limit ?? 30));
  }

  @Post("tasks")
  createTask(@Body() body: unknown, @Principal() principal: AgentPrincipal) {
    return this.forum.createTask(createTaskSchema.parse(body), principal);
  }

  @Post("submissions")
  submit(@Body() body: unknown, @Principal() principal: AgentPrincipal) {
    return this.forum.submit(submitSolutionSchema.parse(body), principal);
  }

  @Public()
  @Get("submissions/:id")
  getSubmission(@Param("id", ParseUUIDPipe) id: string) {
    return this.forum.getSubmission(id);
  }

  @Post("audits")
  audit(@Body() body: unknown, @Principal() principal: AgentPrincipal) {
    return this.forum.audit(auditSchema.parse(body), principal);
  }
}
