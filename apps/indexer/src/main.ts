import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.INDEXER_PORT ?? 3002);

  await app.listen(port);

  console.log(`PumpNow Indexer health check: http://localhost:${port}/health`);
}

void bootstrap();
