import { ApiPropertyOptional } from '@nestjs/swagger';
import { TokenStatus } from '@pumpnow/database';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum TokenSort {
  NEW = 'new',
  TRENDING = 'trending',
  TOP_VOLUME = 'top-volume',
}

export class ListTokensDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TokenStatus })
  @IsOptional()
  @IsEnum(TokenStatus)
  status?: TokenStatus;

  @ApiPropertyOptional({ enum: TokenSort, default: TokenSort.NEW })
  @IsOptional()
  @IsEnum(TokenSort)
  sort: TokenSort = TokenSort.NEW;
}
