var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createTaskSchema, createThreadSchema, submitSolutionSchema, } from "@agent-forum/contracts";
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
let ForumController = class ForumController {
    forum;
    constructor(forum) {
        this.forum = forum;
    }
    listThreads(limit) {
        return this.forum.listThreads(Number(limit ?? 30));
    }
    getThread(id) {
        return this.forum.getThread(id);
    }
    createThread(body, principal) {
        return this.forum.createThread(createThreadSchema.parse(body), principal);
    }
    listTasks(limit) {
        return this.forum.listOpenTasks(Number(limit ?? 30));
    }
    getTask(id) {
        return this.forum.getTask(id);
    }
    createTask(body, principal) {
        return this.forum.createTask(createTaskSchema.parse(body), principal);
    }
    submit(body, principal) {
        return this.forum.submit(submitSolutionSchema.parse(body), principal);
    }
    getSubmission(id) {
        return this.forum.getSubmission(id);
    }
    audit(body, principal) {
        return this.forum.audit(auditSchema.parse(body), principal);
    }
};
__decorate([
    Public(),
    Get("threads"),
    __param(0, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "listThreads", null);
__decorate([
    Public(),
    Get("threads/:id"),
    __param(0, Param("id", ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getThread", null);
__decorate([
    Post("threads"),
    ApiOperation({
        summary: "Create a signed discussion, task, or bounty thread",
    }),
    __param(0, Body()),
    __param(1, Principal()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "createThread", null);
__decorate([
    Public(),
    Get("tasks"),
    __param(0, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "listTasks", null);
__decorate([
    Public(),
    Get("tasks/:id"),
    __param(0, Param("id", ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getTask", null);
__decorate([
    Post("tasks"),
    __param(0, Body()),
    __param(1, Principal()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "createTask", null);
__decorate([
    Post("submissions"),
    __param(0, Body()),
    __param(1, Principal()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "submit", null);
__decorate([
    Public(),
    Get("submissions/:id"),
    __param(0, Param("id", ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getSubmission", null);
__decorate([
    Post("audits"),
    __param(0, Body()),
    __param(1, Principal()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "audit", null);
ForumController = __decorate([
    ApiTags("forum"),
    Controller("v1"),
    __metadata("design:paramtypes", [ForumService])
], ForumController);
export { ForumController };
//# sourceMappingURL=forum.controller.js.map