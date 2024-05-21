import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import isEmail from 'validator/lib/isEmail';
import { ErrorCode } from 'src/common/constants/errorcode.enum';
import { MeetingRoomType } from 'src/common/constants/meeting-room.enum';

export class CreateScheduleRoomDto {
  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.NAME_IS_NOT_EMPTY })
  @MaxLength(255, {
    message: ErrorCode.NAME_IS_TOO_LONG,
  })
  @IsString({ message: ErrorCode.NAME_IS_NOT_STRING })
  name: string;

  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.DATE_STRING_INVALID })
  @IsDateString(undefined, { message: ErrorCode.DATE_STRING_INVALID })
  startTime: string;

  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.DATE_STRING_INVALID })
  @IsDateString(undefined, { message: ErrorCode.DATE_STRING_INVALID })
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MeetingRoomType, { message: ErrorCode.ROOM_TYPE_INVALID })
  type?: MeetingRoomType;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateBy({
    name: 'invitedEmails',
    validator: {
      validate: (value, args: any) => {
        const invitedEmails = args.object.invitedEmails;
        let checkEmail = true;
        invitedEmails.forEach((email: any) => {
          if (
            typeof email !== 'string' ||
            !isEmail(email, { domain_specific_validation: true })
          )
            checkEmail = false;
        });
        return checkEmail;
      },
      defaultMessage: () => ErrorCode.EMAIL_INVALID,
    },
  })
  @IsArray()
  invitedEmails?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(1000, {
    message: ErrorCode.DESCRIPTION_IS_TOO_LONG,
  })
  @IsString({ message: ErrorCode.DESCRIPTION_IS_NOT_STRING })
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: ErrorCode.HAS_SEND_MAIL_INVALID })
  hasSendMail?: boolean;
}
