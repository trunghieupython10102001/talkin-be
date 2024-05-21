import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ErrorCode } from 'src/common/constants/errorcode.enum';
import { CreateScheduleRoomDto } from './create-schedule-room.dto';

export class UpdateScheduleRoomDto extends CreateScheduleRoomDto {
  @ApiProperty()
  @IsNotEmpty({ message: ErrorCode.ID_IS_NOT_EMPTY })
  @IsString({ message: ErrorCode.ID_IS_NOT_STRING })
  id: string;
}
