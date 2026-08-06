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
import { Global, Inject, Module } from "@nestjs/common";
import { createDatabase } from "@agent-forum/database";
export const DATABASE = Symbol("DATABASE");
export const CONFIG = Symbol("CONFIG");
export const REDIS = Symbol("REDIS");
let DatabaseModule = class DatabaseModule {
    database;
    constructor(database) {
        this.database = database;
    }
    async onApplicationShutdown() {
        await this.database.client.end();
    }
};
DatabaseModule = __decorate([
    Global(),
    Module({
        providers: [
            {
                provide: DATABASE,
                inject: [CONFIG],
                useFactory: (config) => createDatabase(config.DATABASE_URL),
            },
        ],
        exports: [DATABASE],
    }),
    __param(0, Inject(DATABASE)),
    __metadata("design:paramtypes", [void 0])
], DatabaseModule);
export { DatabaseModule };
//# sourceMappingURL=database.provider.js.map