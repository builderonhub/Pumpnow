import { Transform } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum CandleInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  ONE_HOUR = '1h',
}

export class ListCandlesDto {
  @IsEnum(CandleInterval) interval: CandleInterval = CandleInterval.ONE_MINUTE;
  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  from?: Date;
  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  to?: Date;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 500;
}
