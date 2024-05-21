import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ErrorCode } from 'src/common/constants/errorcode.enum';

export class CancelScheduleRoomDto {
  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.ID_IS_NOT_EMPTY })
  @IsString({ message: ErrorCode.ID_IS_NOT_STRING })
  id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: ErrorCode.HAS_SEND_MAIL_INVALID })
  hasSendMail?: string;
}
