import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UserService } from './user.service';
import { UpdateUserDto } from './dtos/update-user.dto';
import { AuthGuardRequest } from '../auth/guards/auth.guard';
import { ErrorCode } from 'src/common/constants/errorcode.enum';

@ApiTags('users')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req: any, file: any, cb: any) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @Post('upload-avatar')
  async uploadAvatar(
    @UploadedFile('file') file: Express.Multer.File,
    @Req() req: AuthGuardRequest,
  ) {
    if (!file) {
      throw new BadRequestException(ErrorCode.INVALID_AVATAR);
    }

    if (file.size > 5000000) {
      throw new PayloadTooLargeException(ErrorCode.FILE_SIZE_TOO_LARGE);
    }
    await this.userService.update({}, req.user.id, { avatar: file.path });

    return { status: HttpStatus.OK };
  }

  @ApiBearerAuth()
  @Get('/profile')
  async getProfile(@Req() req: AuthGuardRequest) {
    return this.userService.getProfile(req, req.user.id);
  }

  @ApiBody({
    type: UpdateUserDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  @ApiBearerAuth()
  @Put('/profile')
  async updateProfile(
    @Req() req: AuthGuardRequest,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const userId = req.user.id;
    return this.userService.updateProfile(userId, updateUserDto);
  }
}
