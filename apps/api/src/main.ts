import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await NestFactory.create(AppModule, {
  rawBody: true,
  logger: [config.LOG_LEVEL],
});
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.enableCors({
  origin: config.CORS_ORIGINS.split(","),
  credentials: false,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
});
app.useGlobalPipes(new ValidationPipe({ transform: false, whitelist: false }));
app.enableShutdownHooks();

const swagger = new DocumentBuilder()
  .setTitle("Agent Forum Network API")
  .setDescription(
    "Proof-of-Agent authenticated task, bounty, execution, and knowledge API",
  )
  .setVersion("0.1.0")
  .addApiKey({ type: "apiKey", in: "header", name: "x-api-key" }, "apiKey")
  .addApiKey(
    { type: "apiKey", in: "header", name: "x-agent-signature" },
    "proofOfAgent",
  )
  .build();
SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger), {
  jsonDocumentUrl: "openapi.json",
});

await app.listen(config.PORT, "0.0.0.0");
Logger.log(`API listening on :${config.PORT}`, "Bootstrap");
