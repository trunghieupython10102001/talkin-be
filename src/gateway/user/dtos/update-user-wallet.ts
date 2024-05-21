import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UpdateUserWalletDto {
  @ApiProperty({})
  @IsNotEmpty({
    message: 'wallet address is required',
  })
  address: string;
}
