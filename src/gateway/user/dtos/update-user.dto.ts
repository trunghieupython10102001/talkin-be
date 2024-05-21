import {
  IsDateString,
  IsEnum,
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
import { Gender } from 'src/common/constants/gender.enum';

export class UpdateUserDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(undefined, { message: ErrorCode.DATE_STRING_INVALID })
  birthday?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(Gender, {
    message: ErrorCode.GENDER_INVALID,
  })
  @Expose({ name: 'gender' })
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(
    /^(?:(?:\(?(?:00|\+)([1-4]\d\d|[1-9]\d*)\)?)[\-\.\ \\\/]?)?((?:\(?\d{1,}\)?[\-\.\ \\\/]?)+)(?:[\-\.\ \\\/]?(?:#|ext\.?|extension|x)[\-\.\ \\\/]?(\d+))?$/i,
    {
      message: ErrorCode.INVALID_PHONE_NUMBER_FORMAT,
    },
  )
  @Expose({ name: 'phone' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({
    message: ErrorCode.ADDRESS_IS_NOT_STRING,
  })
  @MaxLength(200, {
    message: ErrorCode.ADDRESS_IS_TOO_LONG,
  })
  @Expose({ name: 'address' })
  address?: string;

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
