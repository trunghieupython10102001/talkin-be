import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Expose } from 'class-transformer';
import { ErrorCode } from 'src/common/constants/errorcode.enum';
import { IsEmailAddress } from 'src/common/utils/IsEmailAddress';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsEmailAddress()
  @IsNotEmpty({
    message: ErrorCode.EMAIL_IS_NOT_EMPTY,
  })
  email: string;

  @ApiProperty()
  @IsString({
    message: ErrorCode.NAME_IS_NOT_STRING,
  })
  @IsNotEmpty({
    message: ErrorCode.NAME_IS_NOT_EMPTY,
  })
  @MaxLength(30, {
    message: ErrorCode.NAME_IS_TOO_LONG,
  })
  firstname: string;

  @ApiProperty()
  @IsString({
    message: ErrorCode.NAME_IS_NOT_STRING,
  })
  @IsNotEmpty({
    message: ErrorCode.NAME_IS_NOT_EMPTY,
  })
  @MaxLength(30, {
    message: ErrorCode.NAME_IS_TOO_LONG,
  })
  lastname: string;

  @ApiProperty()
  @IsString({
    message: ErrorCode.PASSWORD_IS_NOT_STRING,
  })
  @IsNotEmpty({
    message: ErrorCode.PASSWORD_IS_NOT_EMPTY,
  })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,30}(?:[@$!%*?&])?$/, {
    message: ErrorCode.INVALID_PASSWORD_FORMAT,
  })
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({
    message: ErrorCode.AVATAR_IS_NOT_STRING,
  })
  @Expose({ name: 'avatar' })
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(1000, {
    message: ErrorCode.DESCRIPTION_IS_TOO_LONG,
  })
  @IsString({
    message: ErrorCode.DESCRIPTION_IS_NOT_STRING,
  })
  @Expose({ name: 'description' })
  description?: string;
}
