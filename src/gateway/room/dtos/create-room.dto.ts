import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ErrorCode } from 'src/common/constants/errorcode.enum';

export class CreateRoomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(255, {
    message: ErrorCode.NAME_IS_TOO_LONG,
  })
  @IsString({ message: ErrorCode.NAME_IS_NOT_STRING })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(undefined, { message: ErrorCode.DATE_STRING_INVALID })
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(1000, {
    message: ErrorCode.DESCRIPTION_IS_TOO_LONG,
  })
  @IsString({ message: ErrorCode.DESCRIPTION_IS_NOT_STRING })
  description?: string;
}
