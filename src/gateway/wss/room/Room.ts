import {
  Producer,
  Router,
  RouterOptions,
  Worker,
  WebRtcTransport,
  Consumer,
  AudioLevelObserver,
} from 'mediasoup/node/lib/types';

import * as io from 'socket.io';
import * as config from 'config';

import {
  IPeer,
  IPeerData,
  IPeerInfo,
  ICreateConsumerArgs,
} from '../wss.interfaces';
import { cloneObject } from 'src/common/lib';
import { rpcMethod } from './helper';
import { PrismaService } from 'src/share/prisma/prisma.service';
import { MailService } from 'src/share/mailer/mail.service';

const mediasoupSettings = config.get<IMediasoupSettings>('mediasoup');

abstract class Room {
  public readonly peers: Map<string, IPeer> = new Map();

  public router: Router;

  protected presenter: any = null;
  protected audioLevelObserver: AudioLevelObserver;

  constructor(
    private worker: Worker,
    public workerIndex: number,
    public readonly id: string,
    protected readonly wssServer: io.Server,
    protected prismaService: PrismaService,
    protected mailService: MailService,
  ) {}

  // ╭──────────────────────────────────────────────────────────╮
  // │                  WebRTC related methods                  │
  // ╰──────────────────────────────────────────────────────────╯
  public async initRouter() {
    this.router = await this.worker.createRouter({
      mediaCodecs: cloneObject(mediasoupSettings.router.mediaCodecs),
    } as RouterOptions);

    this.audioLevelObserver = await this.router.createAudioLevelObserver({
      maxEntries: 1,
      threshold: -80,
      interval: 800,
    });

    this.audioLevelObserver.on('volumes', (volumes) => {
      // Open comment code when FE doing activeSpeaker
      // const { producer } = volumes[0];
      // this.broadcast('notification', {
      //   method: 'activeSpeaker',
      //   data: {
      //     peerId: producer.appData.peerId,
      //   },
      // });
    });

    this.audioLevelObserver.on('silence', () => {
      // Open comment code when FE doing activeSpeaker
      // this.broadcast('notification', {
      //   method: 'activeSpeaker',
      //   data: {
      //     peerId: null,
      //   },
      // });
    });
  }

  @rpcMethod
  protected getRouterRtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  @rpcMethod
  protected async createWebRtcTransport(payload: any) {
    const { peerId, data } = payload;
    const { consuming, producing } = data;

    const peer = this.peers.get(peerId);

    const { initialAvailableOutgoingBitrate } =
      mediasoupSettings.webRtcTransport;

    const transport = await this.router.createWebRtcTransport({
      listenIps: mediasoupSettings.webRtcTransport.listenIps,
      enableUdp: true,
      enableSctp: true,
      enableTcp: true,
      initialAvailableOutgoingBitrate,
      appData: { peerId, consuming, producing },
    });

    // store transport to peer
    peer.data.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  @rpcMethod
  protected async connectWebRtcTransport(payload: any) {
    const { data, peerId } = payload;
    const { transportId, dtlsParameters } = data;

    const peer = this.peers.get(peerId);
    const transport = peer.data.transports.get(transportId);

    if (!transport)
      throw new Error(`transport with id "${transportId}" not found`);

    // prevent peer connecting a transport multiple times
    if (
      transport.dtlsState === 'connected' ||
      transport.dtlsState === 'connecting'
    ) {
      console.log('Transport is already connected or connecting!');
    } else {
      console.log('Transport is new.');
      await transport.connect({ dtlsParameters });
    }

    return { msg: 'transport connected', ok: true };
  }

  @rpcMethod
  protected async produce(payload: any) {
    const { peerId, data } = payload;
    const { transportId, kind, rtpParameters, appData } = data;

    const peer = this.peers.get(peerId);

    const transport = peer.data.transports.get(transportId);

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: {
        peerId,
        kind,
        displayName: peer.peerInfo.displayName,
        share: appData?.share,
      },
    });

    peer.data.producers.set(producer.id, producer);

    if (producer.kind === 'audio') {
      await this.audioLevelObserver.addProducer({
        producerId: producer.id,
      });
    }

    if (appData?.share) {
      this.presenter = { peerId, producerId: producer.id };
    }

    const otherPeers = this.getJoinedPeers({ excludeId: peer.id });

    for (const otherPeer of otherPeers) {
      this.createConsumer({
        consumerPeer: otherPeer,
        producerPeer: peer,
        producer,
      });
    }

    return { id: producer.id };
  }

  protected async createConsumer(args: ICreateConsumerArgs) {
    const { consumerPeer, producerPeer, producer } = args;
    console.log('create consumer', consumerPeer.id);

    const transport = Array.from(consumerPeer.data.transports.values()).find(
      (t) => {
        return t.appData.consuming;
      },
    );

    if (!transport) {
      console.warn('createConsumer() | Transport for consuming not found');
      return;
    }

    let consumer: Consumer;

    try {
      consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities: consumerPeer.data.rtpCapabilities,
        // Enable NACK for OPUS.
        enableRtx: true,
        paused: true,
      });

      consumerPeer.io.emit('newConsumer', {
        peerId: producerPeer.id,
        producerId: producer.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        appData: producer.appData,
        producerPaused: consumer.producerPaused,
      });

      await consumer.resume();
    } catch (error) {
      console.warn('createConsumer() | transport.consume():%o', error);

      return;
    }

    // Store the Consumer into data Object.
    consumerPeer.data.consumers.set(consumer.id, consumer);

    // Set Consumer events.
    consumer.on('transportclose', () => {
      // Remove from its map.
      consumerPeer.data.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      // Remove from its map.
      consumerPeer.data.consumers.delete(consumer.id);

      this.notifyPeer(consumerPeer.io, 'consumerClosed', {
        consumerId: consumer.id,
        appData: producer.appData,
      });
    });

    consumer.on('producerpause', () => {
      this.notifyPeer(consumerPeer.io, 'consumerPaused', {
        consumerId: consumer.id,
      });
    });

    consumer.on('producerresume', () => {
      this.notifyPeer(consumerPeer.io, 'consumerResumed', {
        consumerId: consumer.id,
      });
    });
  }

  @rpcMethod
  protected async restartIce(payload: any) {
    const { data, peerId } = payload;
    const { transportId } = data;

    const peer = this.peers.get(peerId);
    const transport = peer.data.transports.get(transportId);

    if (!transport)
      throw new Error(`transport with id "${transportId}" not found`);

    const iceParameters = await transport.restartIce();
    return iceParameters;
  }

  @rpcMethod
  protected async pauseProducer(payload: any) {
    const { peerId, data } = payload;
    const { producerId } = data;

    const peer = this.peers.get(peerId);
    const producer = peer.data.producers.get(producerId);

    if (!producer)
      throw new Error(`producer with id "${producerId}" not found`);

    await producer.pause();
    return { done: true };
  }

  @rpcMethod
  protected async closeProducer(payload: any) {
    const { peerId, data } = payload;
    const { producerId } = data;

    const peer = this.peers.get(peerId);
    const producer = peer.data.producers.get(producerId);

    if (!producer)
      throw new Error(`producer with id "${producerId}" not found`);

    if (producer.appData?.share) {
      this.presenter = null;
    }

    producer.close();

    // remove closed producer from peer producers map
    peer.data.producers.delete(producerId);
    return { done: true };
  }

  @rpcMethod
  protected async resumeProducer(payload: any) {
    const { peerId, data } = payload;
    const { producerId } = data;

    const peer = this.peers.get(peerId);
    const producer = peer.data.producers.get(producerId);

    if (!producer)
      throw new Error(`producer with id "${producerId}" not found`);

    await producer.resume();

    return { done: true };
  }

  @rpcMethod
  protected chat(payload: any) {
    const { peerId, data } = payload;
    const { content } = data;
    const sentAt = new Date();

    const peer = this.peers.get(peerId);

    if (!peer || peer.isWaiting) return;

    peer.io.to(this.id).emit('notification', {
      method: 'chat',
      data: {
        peerId,
        content,
        sentAt,
      },
    });

    return { done: true };
  }

  // Abstract methods
  protected abstract join(payload: any);

  protected handleNewPeer(peer: IPeer) {
    peer.isWaiting = false;
    peer.io.join(this.id);
    peer.io.on('disconnect', () => this.handleLeavePeer(peer.id));
  }

  // ╭──────────────────────────────────────────────────────────╮
  // │                       Util methods                       │
  // ╰──────────────────────────────────────────────────────────╯
  /**
   * Add peer to the room
   * always in waiting status
   * whenever join event is fired -> peer is joined
   *
   */
  public addPeer(peerId: string, socket: io.Socket, peerInfo: IPeerInfo) {
    this.peers.set(peerId, {
      id: peerId,
      io: socket,
      isWaiting: true,
      data: {
        transports: new Map<string, WebRtcTransport>(),
        producers: new Map<string, Producer>(),
        consumers: new Map<string, Consumer>(),
        device: 'userDevice',
      } as IPeerData,
      peerInfo,
    });
  }

  public getPeer(peerId: string) {
    return this.peers.get(peerId);
  }

  public getAllPeers() {
    return this.peers;
  }

  public handleLeavePeer(peerId: string) {
    this.removePeer(peerId);
    this.broadcast('notification', {
      method: 'peerClosed',
      data: {
        peerId: peerId,
      },
    });
  }

  public removePeer(peerId: string) {
    const peer = this.peers.get(peerId);

    if (!peer) return;

    // close all producers of removed peer
    for (const producer of peer.data.producers.values()) {
      if (producer.appData?.share) {
        this.presenter = null;
      }
      producer.close();
    }

    // close all transports of removed peer
    for (const transport of peer.data.transports.values()) {
      transport.close();
    }

    // remove peer from peers map
    this.peers.delete(peerId);
  }

  // get all peers (waiting peers are included)
  public getPeers({ excludeId }: { excludeId: string }) {
    const peers = Array.from(this.peers.values()).filter(
      (joinedPeer) => joinedPeer.id !== excludeId,
    );

    return peers;
  }

  get peersCount(): number {
    return this.peers.size;
  }

  public close() {
    this.audioLevelObserver.close();
    this.router.close();
  }

  public getJoinedPeers({ excludeId }: { excludeId: string }) {
    const peers = Array.from(this.peers.values()).filter(
      (joinedPeer) => joinedPeer.id !== excludeId && !joinedPeer.isWaiting,
    );

    return peers;
  }

  public notifyPeer(peer: io.Socket, eventName: string, payload: any) {
    peer.emit('notification', {
      method: eventName,
      data: payload,
    });
  }

  protected broadcast(eventName: string, payload: any) {
    this.wssServer.to(this.id).emit(eventName, payload);
  }

  public async handleEvent(eventName: string, payload: any) {
    const foundHandler = this[eventName];

    if (!foundHandler || !foundHandler.isRpcMethod) {
      return Promise.resolve(`Err! Not found ${eventName} handler`);
    }
    try {
      const data = await foundHandler.apply(this, [payload]);
      return data;
    } catch {
      return Promise.resolve(`Err! ${eventName} handler ERROR`);
    }
  }
}

export default Room;
