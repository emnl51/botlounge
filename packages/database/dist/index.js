import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
export function createDatabase(databaseUrl) {
    const client = postgres(databaseUrl, {
        max: Number(process.env.DB_POOL_SIZE ?? 20),
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
    });
    return { db: drizzle(client, { schema }), client };
}
export * from "./schema.js";
//# sourceMappingURL=index.js.map