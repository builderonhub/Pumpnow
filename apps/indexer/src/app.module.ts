import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./redis/redis.module";
import { validateEnvironment } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: "../../.env",
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
