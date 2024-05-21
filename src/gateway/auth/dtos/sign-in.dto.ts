import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ErrorCode } from 'src/common/constants/errorcode.enum';
import { IsEmailAddress } from 'src/common/utils/IsEmailAddress';
import { ApiProperty } from '@nestjs/swagger';
export class SignInDTO {
  @ApiProperty()
  @IsEmailAddress()
  @IsNotEmpty({
    message: ErrorCode.EMAIL_IS_NOT_EMPTY,
  })
  email: string;

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
}
