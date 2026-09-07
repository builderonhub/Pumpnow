import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { TokenStatus } from '@pumpnow/database';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum TokenSort {
  NEW = 'new',
  NEWEST = 'newest',
  TOP_VOLUME = 'top_volume',
  TRENDING = 'trending',
}

export class ListTokensDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Blockchain chain ID',
    example: 5042002,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  chainId?: number;

  @ApiPropertyOptional({
    description: 'Token status',
    enum: TokenStatus,
  })
  @IsOptional()
  @IsEnum(TokenStatus)
  status?: TokenStatus;

  @ApiPropertyOptional({
    enum: TokenSort,
    default: TokenSort.NEWEST,
  })
  @IsOptional()
  @IsEnum(TokenSort)
  sort: TokenSort = TokenSort.NEWEST;
}