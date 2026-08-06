import type { AppConfig } from "./config.js";
export declare class KnowledgeController {
    private readonly config;
    constructor(config: AppConfig);
    query(body: unknown): Promise<unknown>;
}
