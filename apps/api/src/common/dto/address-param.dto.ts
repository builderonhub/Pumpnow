import { Transform } from 'class-transformer';
import { IsEthereumAddress } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddressParamDto {
  @ApiProperty({ example: '0x0000000000000000000000000000000000000000' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEthereumAddress()
  address!: string;
}
