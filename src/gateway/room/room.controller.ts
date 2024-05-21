import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { CreateRoomDto } from './dtos/create-room.dto';
import { RoomService } from './room.service';
import { Public } from 'src/gateway/auth/decorator/public';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuardRequest } from '../auth/guards/auth.guard';
import { CreateScheduleRoomDto } from './dtos/create-schedule-room.dto';
import { UpdateScheduleRoomDto } from './dtos/update-schedule-room.dto';
import { CancelScheduleRoomDto } from './dtos/cancel-schedule-room.dto';

@ApiTags('room')
@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @ApiBody({
    type: CreateRoomDto,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
  })
  @ApiBearerAuth()
  @Post()
  async createRoom(
    @Req() req: AuthGuardRequest,
    @Body() roomDto: CreateRoomDto,
  ) {
    const creatorId = req.user.id;
    return this.roomService.createRoom(creatorId, roomDto);
  }

  @ApiBody({
    type: CreateScheduleRoomDto,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
  })
  @ApiBearerAuth()
  @Post('/schedule')
  async createScheduleRoom(
    @Req() req: AuthGuardRequest,
    @Body() roomDto: CreateScheduleRoomDto,
  ) {
    const creatorId = req.user.id;
    return this.roomService.createScheduleRoom(creatorId, roomDto);
  }

  @ApiBody({
    type: UpdateScheduleRoomDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  @ApiBearerAuth()
  @Put('/schedule')
  async updateScheduleRoom(
    @Req() req: AuthGuardRequest,
    @Body() roomDto: UpdateScheduleRoomDto,
  ) {
    const creatorId = req.user.id;
    return this.roomService.updateScheduleRoom(req, creatorId, roomDto);
  }

  @ApiResponse({
    status: HttpStatus.OK,
  })
  @ApiBearerAuth()
  @Delete('/schedule')
  async deleteScheduleRoom(
    @Req() req: AuthGuardRequest,
    @Query() query: CancelScheduleRoomDto,
  ) {
    const creatorId = req.user.id;
    return this.roomService.deleteScheduleRoom(req, creatorId, query);
  }

  @Public()
  @ApiResponse({
    status: HttpStatus.OK,
  })
  @Get(':id')
  async getRoom(@Req() req: Request, @Param('id') id: string) {
    return this.roomService.getRoom(req, id);
  }
}
