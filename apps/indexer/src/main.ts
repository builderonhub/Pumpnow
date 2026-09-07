import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const corsOrigins = [
    ...new Set([
      ...(config.get<string>("CORS_ORIGINS", "http://localhost:3000") ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      "https://www.pumnow.xyz",
      "https://pumnow.xyz",
      "http://localhost:3000",
    ]),
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = config.get<number>("INDEXER_PORT") ?? 3002;
  await app.listen(port);
}

void bootstrap();