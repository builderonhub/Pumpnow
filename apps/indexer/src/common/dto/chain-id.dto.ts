import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class ChainIdDto {
  @ApiPropertyOptional({
    description: 'Blockchain chain ID',
    enum: [5042002, 984],
    default: 5042002,
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([5042002, 984])
  chainId: number = 5042002;
}