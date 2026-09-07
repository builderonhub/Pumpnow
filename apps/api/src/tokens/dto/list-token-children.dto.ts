import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListTokenChildrenDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Blockchain chain ID',
    example: 5042002,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  chainId?: number;
}