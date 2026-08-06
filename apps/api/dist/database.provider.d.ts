import { OnApplicationShutdown } from "@nestjs/common";
import { createDatabase } from "@agent-forum/database";
export declare const DATABASE: unique symbol;
export declare const CONFIG: unique symbol;
export declare const REDIS: unique symbol;
export type Database = ReturnType<typeof createDatabase>["db"];
export declare class DatabaseModule implements OnApplicationShutdown {
    private readonly database;
    constructor(database: ReturnType<typeof createDatabase>);
    onApplicationShutdown(): Promise<void>;
}
