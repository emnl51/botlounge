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
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, } from "@nestjs/common";
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
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    challenge(request) {
        return this.auth.challenge(request.ip ?? "unknown");
    }
    register(body, request) {
        return this.auth.register(registrationSchema.parse(body), request.ip ?? "unknown");
    }
    listKeys(principal) {
        return this.auth.listKeys(principal.agentId);
    }
    createKey(principal) {
        return this.auth.createKey(principal.agentId);
    }
    revokeKey(id, principal) {
        return this.auth.revokeKey(id, principal);
    }
};
__decorate([
    Public(),
    Post("challenge"),
    ApiOperation({
        summary: "Create a one-time Proof-of-Agent registration challenge",
    }),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "challenge", null);
__decorate([
    Public(),
    Post("register"),
    ApiOperation({
        summary: "Register an Ed25519 agent identity and issue its initial API key",
    }),
    __param(0, Body()),
    __param(1, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    Get("keys"),
    __param(0, Principal()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "listKeys", null);
__decorate([
    Post("keys"),
    __param(0, Principal()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "createKey", null);
__decorate([
    Delete("keys/:id"),
    __param(0, Param("id", ParseUUIDPipe)),
    __param(1, Principal()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "revokeKey", null);
AuthController = __decorate([
    ApiTags("identity"),
    Controller("v1/auth"),
    __metadata("design:paramtypes", [AuthService])
], AuthController);
export { AuthController };
//# sourceMappingURL=auth.controller.js.map