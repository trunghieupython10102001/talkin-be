import {
  Consumer,
  Producer,
  Worker,
  WebRtcTransport,
  PlainTransport,
  RtpCodecCapability,
  RtpParameters,
} from 'mediasoup/node/lib/types';
import io from 'socket.io';
import { MailService } from 'src/share/mailer/mail.service';
import { PrismaService } from 'src/share/prisma/prisma.service';
import { FFmpeg } from './room/recording/FFmpeg';

export interface IClientQuery {
  readonly accessToken: string;
  readonly roomId: string;
  readonly isLivestreamRoom: string;
  readonly device: string;
}

export interface IPeerInfo {
  readonly userId?: string;
  displayName?: string;
  readonly avatarUrl?: string;
  readonly description?: string;
  readonly roomId: string;
  readonly isLivestreamRoom: boolean;
  readonly device: string;
  readonly isGuest?: boolean;
  readonly isHost?: boolean;
}

export interface ICreateConsumerArgs {
  consumerPeer: IPeer;
  producerPeer: IPeer;
  producer: Producer;
}

export interface IPeer {
  id: string;
  io: io.Socket;
  isWaiting: boolean;
  data?: IPeerData;
  peerInfo?: IPeerInfo;
}

export interface IPeerData {
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  rtpCapabilities: any;
  sctpCapabilities: any;
  device: any;
  displayName: any;
}

export interface IMediasoupPeer {
  producerVideo?: Producer;
  producerAudio?: Producer;
  producerTransport?: WebRtcTransport;
  consumerTransport?: WebRtcTransport;
  consumersVideo?: Map<string, Consumer>;
  consumersAudio?: Map<string, Consumer>;
}

export interface IWorkerInfo {
  workerIndex: number;
  peersCount: number;
  roomsCount: number;
  pidInfo?: object;
}

export interface RoomParams {
  worker: Worker;
  workerIndex: number;
  readonly id: string;
  readonly wssServer: io.Server;
  mailService: MailService;
  prismaService: PrismaService;
}

export interface IRecorder {
  peerId: string;
  transports: Map<string, PlainTransport>;
  processes: Map<string, FFmpeg>;
  consumers?: Map<string, Consumer>;
  videoConsumer?: Consumer;
  audioConsumer?: Consumer;
  screenConsumer?: Consumer;
  videoRecorderProcess?: FFmpeg;
  screenRecorderProcess?: FFmpeg;
  audioRecorderProcess?: FFmpeg;
  process?: FFmpeg;
  remotePorts?: number[];
  script: any;
}

export interface IPublishedProducer {
  remoteRtpPort: number;
  remoteRtcpPort: number;
  localRtcpPort: number | undefined;
  rtpCapabilities: {
    codecs: RtpCodecCapability[];
    rtcpFeedback: string[];
  };
  rtpParameters: RtpParameters;
}

export interface IRecordInfo {
  audio?: IPublishedProducer;
  video?: IPublishedProducer;
  fileName: string;
}
