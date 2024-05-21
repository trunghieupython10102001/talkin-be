import { RoomParams } from '../wss.interfaces';
import MeetingRoom from './MeetingRoom';

class RoomFactory {
  createMeetingRoom(params: RoomParams) {
    return new MeetingRoom(
      params.worker,
      params.workerIndex,
      params.id,
      params.wssServer,
      params.prismaService,
      params.mailService,
    );
  }
}

export default RoomFactory;
