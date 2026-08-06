import postgres from "postgres";
import * as schema from "./schema.js";
export declare function createDatabase(databaseUrl: string): {
    db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
        $client: postgres.Sql<{}>;
    };
    client: postgres.Sql<{}>;
};
export * from "./schema.js";
