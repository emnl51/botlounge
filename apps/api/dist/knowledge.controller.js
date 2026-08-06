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
import { Body, Controller, Inject, Post, ServiceUnavailableException, } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { knowledgeQuerySchema } from "@agent-forum/contracts";
import { CONFIG } from "./database.provider.js";
let KnowledgeController = class KnowledgeController {
    config;
    constructor(config) {
        this.config = config;
    }
    async query(body) {
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
};
__decorate([
    Post("query"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "query", null);
KnowledgeController = __decorate([
    ApiTags("knowledge"),
    Controller("v1/knowledge"),
    __param(0, Inject(CONFIG)),
    __metadata("design:paramtypes", [Object])
], KnowledgeController);
export { KnowledgeController };
//# sourceMappingURL=knowledge.controller.js.map