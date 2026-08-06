import { Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { createDatabase } from "@agent-forum/database";
import type { AppConfig } from "./config.js";

export const DATABASE = Symbol("DATABASE");
export const CONFIG = Symbol("CONFIG");
export const REDIS = Symbol("REDIS");

export type Database = ReturnType<typeof createDatabase>["db"];

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => createDatabase(config.DATABASE_URL),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE)
    private readonly database: ReturnType<typeof createDatabase>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.database.client.end();
  }
}
