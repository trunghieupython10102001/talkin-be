import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/share/prisma/prisma.service';
import { BaseService } from 'src/common/base/base.service';
import { ConfigService } from '@nestjs/config';
import { CreateRoomDto } from './dtos/create-room.dto';
import { CreateScheduleRoomDto } from './dtos/create-schedule-room.dto';
import { ErrorCode } from 'src/common/constants/errorcode.enum';
import { UpdateScheduleRoomDto } from './dtos/update-schedule-room.dto';
import { MeetingRoomStatus } from 'src/common/constants/meeting-room.enum';
import { AuthGuardRequest } from '../auth/guards/auth.guard';
import { MailService } from 'src/share/mailer/mail.service';
import { ScheduleEmailType } from 'src/common/constants/schedule-email-type.enum';
import {
  getFormattedDate,
  getFormattedHourAndMinute,
} from 'src/common/utils/utils';
import { MeetingEmailContext } from 'src/share/mailer/mail-context.interface';
import { Room } from '@prisma/client';
import { CancelScheduleRoomDto } from './dtos/cancel-schedule-room.dto';

// type CreateNewRoomDto = {
//   name?: string | null,
//   startTime?: Date,
//   description?: string | null,
//   creatorId: number
// }

@Injectable()
export class RoomService extends BaseService {
  constructor(
    prisma: PrismaService,
    configService: ConfigService,
    private mailService: MailService,
  ) {
    super(prisma, 'room', 'Room', configService);
  }

  async createRoom(creatorId: number, createRoomDto: CreateRoomDto) {
    const roomDto = {
      ...createRoomDto,
      creatorId,
      startTime: createRoomDto.startTime
        ? new Date(createRoomDto.startTime)
        : undefined,
    };
    const newRoom = await this.create({ creatorId, ...roomDto });
    return newRoom;
  }

  async createScheduleRoom(
    creatorId: number,
    createScheduleRoomDto: CreateScheduleRoomDto,
  ) {
    const roomDto = {
      ...createScheduleRoomDto,
      creatorId,
      startTime: new Date(createScheduleRoomDto.startTime),
      endTime: new Date(createScheduleRoomDto.endTime),
    };
    const hasSendMail = roomDto.hasSendMail;
    delete roomDto.hasSendMail;
    if (roomDto.startTime >= roomDto.endTime) {
      throw new BadRequestException({
        message: ErrorCode.END_TIME_MUST_GREATER_THAN_START_TIME,
      });
    }
    if (roomDto.startTime < new Date()) {
      throw new BadRequestException({
        message: ErrorCode.START_TIME_MUST_GREATER_THAN_CURRENT_TIME,
      });
    }
    const newRoom = await this.create({ creatorId, ...roomDto });
    if (hasSendMail) {
      void this.sendMailScheduleMeeting({
        type: ScheduleEmailType.CREATE,
        newInvitedEmails: newRoom.invitedEmails || [],
        oldInvitedMemberEmails: [],
        meetingId: newRoom.id,
        meetingName: newRoom.name,
        description: newRoom.description,
        startTime: newRoom.startTime,
        endTime: newRoom.endTime,
      });
    }

    return newRoom;
  }

  async updateScheduleRoom(
    request: AuthGuardRequest,
    creatorId: number,
    updateScheduleRoomDto: UpdateScheduleRoomDto,
  ) {
    const roomId = updateScheduleRoomDto.id;
    const hasSendMail = updateScheduleRoomDto.hasSendMail;
    const oldRoom: Room = await this.get(request, roomId);
    if (oldRoom?.creatorId != creatorId) {
      throw new UnauthorizedException();
    }
    if (oldRoom?.status == MeetingRoomStatus.CLOSED) {
      throw new BadRequestException({
        message: ErrorCode.MEETING_ROOM_CANCELLED,
      });
    }

    const roomDto = {
      ...updateScheduleRoomDto,
      creatorId,
      startTime: new Date(updateScheduleRoomDto.startTime),
      endTime: new Date(updateScheduleRoomDto.endTime),
    };
    if (roomDto.startTime >= roomDto.endTime) {
      throw new BadRequestException({
        message: ErrorCode.END_TIME_MUST_GREATER_THAN_START_TIME,
      });
    }
    if (roomDto.startTime < new Date()) {
      throw new BadRequestException({
        message: ErrorCode.START_TIME_MUST_GREATER_THAN_CURRENT_TIME,
      });
    }

    delete roomDto.hasSendMail;
    delete roomDto.id;

    await this.update({}, roomId, roomDto);

    if (hasSendMail) {
      let checkUpdateContent = false;
      if (
        roomDto.startTime != new Date(oldRoom.startTime) ||
        roomDto.endTime != new Date(oldRoom.endTime) ||
        (roomDto.description || null) != (oldRoom.description || null) ||
        roomDto.name != oldRoom.name
      ) {
        checkUpdateContent = true;
      }
      const scheduleEmailType = checkUpdateContent
        ? ScheduleEmailType.UPDATE_CONTENT
        : ScheduleEmailType.UPDATE_GUEST;

      void this.sendMailScheduleMeeting({
        type: scheduleEmailType,
        newInvitedEmails: roomDto.invitedEmails || [],
        oldInvitedMemberEmails: oldRoom.invitedEmails || [],
        meetingId: roomId,
        meetingName: roomDto.name,
        description: roomDto.description,
        startTime: roomDto.startTime,
        endTime: roomDto.endTime,
      });
    }
  }

  async deleteScheduleRoom(
    request: AuthGuardRequest,
    creatorId: number,
    query: CancelScheduleRoomDto,
  ) {
    const roomId = query.id;
    request.query = {};
    const oldRoom: Room = await this.get(request, roomId);
    if (oldRoom?.creatorId != creatorId) {
      throw new UnauthorizedException();
    }
    if (oldRoom?.status == MeetingRoomStatus.CLOSED) {
      throw new BadRequestException({
        message: ErrorCode.MEETING_ROOM_CANCELLED,
      });
    }

    const roomDto = {
      status: MeetingRoomStatus.CLOSED,
    };

    await this.update({}, roomId, roomDto);

    if (query.hasSendMail && query.hasSendMail != 'false') {
      void this.sendMailScheduleMeeting({
        type: ScheduleEmailType.CANCEL,
        newInvitedEmails: oldRoom.invitedEmails || [],
        oldInvitedMemberEmails: oldRoom.invitedEmails || [],
        meetingId: oldRoom.id,
        meetingName: oldRoom.name,
        description: oldRoom.description,
        startTime: oldRoom.startTime,
        endTime: oldRoom.endTime,
      });
    }
  }

  async getRoom(request: AuthGuardRequest, roomId: string) {
    const room = await this.get(request, roomId);
    if (!room) {
      throw new BadRequestException({
        message: ErrorCode.ROOM_NOT_EXISTED,
      });
    }
    if (room?.status == MeetingRoomStatus.CLOSED) {
      throw new BadRequestException({
        message: ErrorCode.MEETING_ROOM_CANCELLED,
      });
    }

    return room;
  }

  getMeetingLink(roomId: string) {
    return process.env.DOMAIN + 'waiting-room/' + roomId;
  }

  async sendMailScheduleMeeting({
    type,
    newInvitedEmails,
    oldInvitedMemberEmails,
    meetingId,
    meetingName,
    description,
    startTime,
    endTime,
  }: {
    type: ScheduleEmailType;
    newInvitedEmails: string[];
    oldInvitedMemberEmails: string[];
    meetingId: string;
    meetingName: string;
    description?: string;
    startTime: Date;
    endTime: Date;
  }) {
    const startDate = getFormattedDate(startTime);
    const endDate = getFormattedDate(endTime);
    const startTimeString = getFormattedHourAndMinute(startTime);
    const endTimeString = getFormattedHourAndMinute(endTime);
    const emailContext: MeetingEmailContext = {
      meetingName,
      startDate,
      endDate,
      startTime: startTimeString,
      endTime: endTimeString,
      description,
      meetingLink: this.getMeetingLink(meetingId),
      meetingId,
      to: '',
    };
    if (type === ScheduleEmailType.CREATE) {
      if (newInvitedEmails.length) {
        emailContext.to = newInvitedEmails.join(',');
        await this.mailService.sendEmailInvitationMeeting(emailContext);
      }
    } else if (
      type === ScheduleEmailType.UPDATE_GUEST ||
      type === ScheduleEmailType.UPDATE_CONTENT
    ) {
      // send invite email to new guest added
      const newEmails = newInvitedEmails.filter(
        (x) => !oldInvitedMemberEmails.includes(x),
      );
      if (newEmails.length) {
        emailContext.to = newEmails.join(',');
        await this.mailService.sendEmailInvitationMeeting(emailContext);
      }

      // send remove email to old guest removed
      const removeEmails = oldInvitedMemberEmails.filter(
        (x) => !newInvitedEmails.includes(x),
      );
      if (removeEmails.length) {
        emailContext.to = removeEmails.join(',');
        await this.mailService.sendEmailCancelMeeting(emailContext);
      }

      // send update email to old guest when schedule content update
      if (type === ScheduleEmailType.UPDATE_CONTENT) {
        const updateEmails = oldInvitedMemberEmails.filter((x) =>
          newInvitedEmails.includes(x),
        );
        if (updateEmails.length) {
          emailContext.to = updateEmails.join(',');
          await this.mailService.sendEmailUpdateMeeting(emailContext);
        }
      }
    } else if (type === ScheduleEmailType.CANCEL) {
      if (oldInvitedMemberEmails?.length) {
        emailContext.to = oldInvitedMemberEmails.join(',');
        await this.mailService.sendEmailCancelMeeting(emailContext);
      }
    }
  }
}
