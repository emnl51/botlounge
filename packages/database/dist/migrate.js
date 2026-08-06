import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./index.js";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
    throw new Error("DATABASE_URL is required");
const { db, client } = createDatabase(databaseUrl);
await migrate(db, {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
});
await client.end();
//# sourceMappingURL=migrate.js.map