import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AppData, WebRtcServerOptions } from 'mediasoup/node/lib/types';
import { Worker, WorkerSettings } from 'mediasoup/node/lib/Worker';

import * as mediasoup from 'mediasoup';
import * as config from 'config';
import * as io from 'socket.io';

import { IClientQuery, IPeerInfo, RoomParams } from './wss.interfaces';
import Room from './room/Room';
import { cloneObject } from 'src/common/lib';
import { WssGuard } from './wss.guard';
import RoomFactory from './room/RoomFactory';
import { PrismaService } from 'src/share/prisma/prisma.service';
import { MailService } from 'src/share/mailer/mail.service';

// const ENABLED_CORS = process.env.NODE_ENV === 'development';
const mediasoupSettings = config.get<IMediasoupSettings>('mediasoup');

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class WssGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server: io.Server;

  private roomFactory: RoomFactory;
  public rooms: Map<string, Room> = new Map();

  public workers: {
    [index: number]: {
      clientsCount: number;
      roomsCount: number;
      pid: number;
      worker: Worker;
    };
  };

  constructor(
    private wssGuard: WssGuard,
    private prismaService: PrismaService,
    private mailService: MailService,
  ) {
    this.createWorkers();
    this.roomFactory = new RoomFactory();
  }

  /**
   * Create mediasoup worker
   * @return {Promise<Worker>} media soup worker
   */
  private async createWorker(index: number): Promise<Worker<AppData>> {
    const worker = await mediasoup.createWorker(
      mediasoupSettings.worker as WorkerSettings,
    );
    // Create a WebRtcServer in this Worker.
    if (process.env.MEDIASOUP_USE_WEBRTC_SERVER !== 'false') {
      // Each mediasoup Worker will run its own WebRtcServer, so those cannot
      // share the same listening ports. Hence we increase the value in config.js
      // for each Worker.
      const webRtcServerOptions = cloneObject(
        mediasoupSettings.webRtcServer,
      ) as IMediasoupWebRtcServer;
      const portIncrement = index;

      for (const listenInfo of webRtcServerOptions.listenInfos) {
        listenInfo.port += portIncrement;
      }

      const webRtcServer = await worker.createWebRtcServer(
        webRtcServerOptions as WebRtcServerOptions,
      );

      worker.appData.webRtcServer = webRtcServer;
    }

    worker.on('died', () => {
      console.error(
        'mediasoup Worker died, exiting  in 2 seconds... [pid:%d]',
        worker.pid,
      );

      setTimeout(() => process.exit(1), 2000);
    });

    // Log worker resource usage every 2 minutes
    setInterval(async () => {
      const usage = await worker.getResourceUsage();

      console.info(
        'mediasoup Worker resource usage [pid:%d]: %o',
        worker.pid,
        usage,
      );
    }, 120000);

    return worker;
  }

  /**
   * Create mediasoup workers in parallel
   * @returns {Promise<void>} Promise<void>
   */
  private async createWorkers(): Promise<void> {
    const createWorkerPromises = [];

    for (let i = 0; i < mediasoupSettings.workerPool; i++) {
      createWorkerPromises.push(this.createWorker(i));
    }

    this.workers = (await Promise.all(createWorkerPromises)).reduce(
      (acc, worker, index) => {
        acc[index] = {
          clientsCount: 0,
          roomsCount: 0,
          pid: worker.pid,
          worker,
        };

        return acc;
      },
      {},
    );
  }

  private getOptimalWorkerIndex(): number {
    return parseInt(
      Object.entries(this.workers).reduce((prev, curr) => {
        if (prev[1].clientsCount < curr[1].clientsCount) {
          return prev;
        }
        return curr;
      })[0],
      10,
    );
  }

  private async getClientQuery(client: io.Socket): Promise<IPeerInfo> {
    try {
      const clientQuery = client.handshake.query as unknown as IClientQuery;
      const clientInfo = await this.wssGuard.verifyClientQuery(clientQuery);
      return clientInfo;
    } catch (error) {
      console.log('getClientQuery ERROR: ', error);
      return;
    }
  }

  private async getOrCreateRoom(roomId: string): Promise<Room> {
    let room = this.rooms.get(roomId);

    if (!room) {
      const index = this.getOptimalWorkerIndex();
      const roomParams = {
        worker: this.workers[index].worker,
        workerIndex: index,
        id: roomId,
        wssServer: this.server,
        mailService: this.mailService,
        prismaService: this.prismaService,
      } as RoomParams;

      room = this.roomFactory.createMeetingRoom(roomParams);

      await room.initRouter();
      this.rooms.set(roomId, room);
    }

    return room;
  }

  handleDisconnect(client: io.Socket) {
    const clientQuery = client.handshake.query as unknown as IClientQuery;
    const { roomId } = clientQuery;
    const room = this.rooms.get(roomId);
    if (!room) return;

    // if there is no client in the room -> close it.
    if (!room.peersCount) {
      room.close();
      this.rooms.delete(roomId);
    }
  }

  /**
   * Clients in waiting room will connect to socket
   * roomId is required, accessToken is optional
   * (empty accessToken means isGuest = true)
   *
   *
   * after verifying client query, we add clients to the waiting list of the
   * room they want to join.
   */
  async handleConnection(client: io.Socket) {
    const clientQuery = client.handshake.query as unknown as IClientQuery;

    // peers want to access room
    const { roomId, isLivestreamRoom } = clientQuery;
    if (roomId) {
      const peerInfo = await this.getClientQuery(client);
      if (!peerInfo) {
        client.disconnect();
        return;
      }

      const room = await this.getOrCreateRoom(roomId);

      // TODO: not allow opening multi tab of a user on a device
      room.addPeer(client.id, client, peerInfo);
    }

    return `Client connected : ${client.id}`;
  }

  @SubscribeMessage('webrtc')
  async handleWebrtcEvents(client: io.Socket, payload: any) {
    const peerInfo = await this.getClientQuery(client);
    if (!peerInfo) {
      client.disconnect();
      this.handleDisconnect(client);
      return;
    }
    const { roomId } = peerInfo;
    const room = await this.getOrCreateRoom(roomId);

    const { method, ...data } = payload;
    return await room.handleEvent(method, {
      ...data,
      peerId: client.id,
    });
  }

  @SubscribeMessage('subscribeRoomStatus')
  async listenToRoom(client: io.Socket, payload: any) {
    const { roomIds } = payload;

    for (const roomId of roomIds) {
      client.join(`RoomStatus_${roomId}`);
    }
  }

  public getRoomSize(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    return room.peersCount;
  }

  public handleRoomStateCancel(roomId: string) {
    const room = this.rooms.get(roomId);
    const payload = {
      id: roomId,
      numberOfViewers: 0,
    };

    // broadcast to all clients are listening to status of room (i.e: homepage)
    this.server.to(`RoomStatus_${roomId}`).emit('roomStatusUpdated', payload);

    if (room) {
      // broadcast to all clients are inside room
      this.server.to(roomId).emit('notification', {
        method: 'roomStatusUpdated',
        data: payload,
      });
      room.close();
      this.rooms.delete(roomId);
    }
  }
}
