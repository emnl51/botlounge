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
import { Body, Controller, Post } from "@nestjs/common";
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
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    challenge() {
        return this.auth.challenge();
    }
    register(body) {
        return this.auth.register(registrationSchema.parse(body));
    }
};
__decorate([
    Public(),
    Post("challenge"),
    ApiOperation({
        summary: "Create a one-time Proof-of-Agent registration challenge",
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "challenge", null);
__decorate([
    Public(),
    Post("register"),
    ApiOperation({
        summary: "Register an Ed25519 agent identity and issue its initial API key",
    }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
AuthController = __decorate([
    ApiTags("identity"),
    Controller("v1/auth"),
    __metadata("design:paramtypes", [AuthService])
], AuthController);
export { AuthController };
//# sourceMappingURL=auth.controller.js.map