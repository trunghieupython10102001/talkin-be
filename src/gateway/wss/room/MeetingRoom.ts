import { UnauthorizedException } from '@nestjs/common';
import { IPeer, IRecorder } from '../wss.interfaces';
import { rpcMethod } from './helper';
import Room from './Room';
import * as config from 'config';

import { getFormattedDate } from 'src/common/utils/utils';
import { MeetingRecordEmailContext } from 'src/share/mailer/mail-context.interface';
import { MeetingRecordType } from 'src/common/constants/meeting-record.enum';
import { getPort, releasePort } from './recording/port';
import { PlainTransport } from 'mediasoup/node/lib/PlainTransport';
import { FFmpeg } from './recording/FFmpeg';
import { Producer } from 'mediasoup/node/lib/Producer';
import { writeFileSync } from 'fs';
import { compose } from 'src/recorder-composer';

class MeetingRoom extends Room {
  private recorder: IRecorder;

  override handleNewPeer(peer: IPeer) {
    super.handleNewPeer(peer);

    // broadcast newPeer event to all user in this room

    peer.io.to(this.id).emit('notification', {
      method: 'newPeer',
      data: {
        id: peer.id,
        displayName: peer.peerInfo.displayName || 'peer - ' + peer.id,
        device: peer.data.device,
        isGuest: peer.peerInfo.isGuest,
        isHost: peer.peerInfo.isHost,
        avatarUrl: peer.peerInfo.avatarUrl,
      },
    });

    const otherPeers = this.getJoinedPeers({ excludeId: peer.id });

    for (const otherPeer of otherPeers) {
      // when a new peer enters the room
      // he/she can consume media of existing peers
      for (const producer of Array.from(otherPeer.data.producers.values())) {
        super.createConsumer({
          consumerPeer: peer,
          producerPeer: otherPeer,
          producer,
        });
      }
    }
  }

  @rpcMethod
  protected join(payload: any) {
    const { peerId, data } = payload;
    const { displayName, device, rtpCapabilities, sctpCapabilities } = data;

    // change flag isWaiting to false
    // then update new peer data
    const peer = this.peers.get(peerId);
    peer.isWaiting = false;
    peer.peerInfo.displayName = peer.peerInfo.displayName || displayName;
    peer.data = {
      ...peer.data,
      device,
      rtpCapabilities,
      sctpCapabilities,
      displayName: peer.peerInfo.displayName,
    };
    this.handleNewPeer(peer);

    // get peers info who already in the room
    // we call it peer here maybe it has to change to peer
    // in the future
    const peerInfos = this.getJoinedPeers({ excludeId: peer.id }).map(
      (joinedPeer) => {
        return {
          id: joinedPeer.id,
          displayName:
            joinedPeer.peerInfo.displayName || 'peer - ' + joinedPeer.id,
          device: joinedPeer.data.device,
          isGuest: joinedPeer.peerInfo.isGuest,
          isHost: joinedPeer.peerInfo.isHost,
          avatarUrl: joinedPeer.peerInfo.avatarUrl,
        };
      },
    );
    return {
      peers: peerInfos,
      isHost: peer.peerInfo.isHost,
      isRecording: !!this.recorder,
      presenter: this.presenter,
    };
  }

  @rpcMethod
  protected async mutePeer(payload: any) {
    try {
      const { peerId, data } = payload;
      const { mutePeerId } = data;

      const hostPeer = this.peers.get(peerId);
      if (!hostPeer?.peerInfo?.isHost) {
        throw new UnauthorizedException();
      }
      const mutePeer = this.peers.get(mutePeerId);
      if (!mutePeer) {
        throw new Error('Peer not found!');
      }

      const muteProducers = Array.from(mutePeer.data.producers.values()).filter(
        (x) => x.kind == 'audio',
      );

      if (muteProducers.length) {
        for (let i = 0; i < muteProducers.length; i++) {
          await this.pauseProducer({
            peerId: mutePeerId,
            data: {
              producerId: muteProducers[i].id,
            },
          });
        }
        this.notifyPeer(mutePeer.io, 'muted', {
          peerId: mutePeerId,
        });
      }

      return true;
    } catch (error) {
      console.log('mutePeer ERROR: ', error);
      return false;
    }
  }

  @rpcMethod
  protected async removePeerByHost(payload: any) {
    try {
      const { peerId, data } = payload;
      const { removePeerId } = data;

      const hostPeer = this.peers.get(peerId);
      if (!hostPeer?.peerInfo?.isHost) {
        throw new UnauthorizedException();
      }
      console.log('removePeerId: ', removePeerId);
      const removePeer = this.peers.get(removePeerId);
      if (!removePeer) {
        throw new Error('Peer not found!');
      }

      this.notifyPeer(removePeer.io, 'kicked', {
        peerId: removePeerId,
      });

      this.removePeer(removePeerId);
      removePeer.io.disconnect();

      this.broadcast('notification', {
        method: 'removedPeer',
        data: {
          peerId: removePeerId,
          displayName:
            removePeer.peerInfo.displayName || 'peer - ' + removePeer.id,
        },
      });

      return true;
    } catch (error) {
      console.log('removePeer ERROR: ', error);
      return false;
    }
  }

  @rpcMethod
  protected async produce(payload: any) {
    const { peerId, data } = payload;
    const { kind, appData } = data;
    const peer = this.getPeer(peerId);

    //can not share while other is sharing screen
    if (this.presenter && appData?.share) {
      throw new Error('Can not share while other is sharing screen');
    }

    const res = await super.produce(payload);
    const producer = peer.data.producers.get(res.id);

    if (this.recorder) {
      if (appData?.share) {
        // if (this.recorder.processes.get('screen')) this.recorder.processes.get('screen').kill();
        if (this.recorder.screenConsumer) this.recorder.screenConsumer.close();
        await this.publishProducerRtpStream(producer, 'video', true);
      } else if (this.recorder.peerId === peerId && kind === 'video') {
        // if (this.recorder.processes.get('video')) this.recorder.processes.get('video').kill();
        if (this.recorder.videoConsumer) this.recorder.videoConsumer.close();
        await this.publishProducerRtpStream(producer, 'video');
      }
    }

    return res;
  }

  @rpcMethod
  protected async requestRecord(payload: any) {
    try {
      const { peerId } = payload;

      console.log('requestRecord PeerId: ', peerId);
      const requestPeer = this.peers.get(peerId);

      // not logged in user can't record
      if (!requestPeer?.peerInfo?.userId) {
        throw new UnauthorizedException();
      }

      // only 1 record at the same time
      if (this.recorder && this.peers.get(this.recorder.peerId)) {
        throw new Error(
          `Can not requestRecord when ${this.recorder.peerId} is recording!`,
        );
      }

      // Add function start record here
      this.handleStartRecord(peerId);

      // emit socket startRecord to other member of the room
      requestPeer.io.to(this.id).emit('notification', {
        method: 'startRecord',
        data: {
          id: requestPeer.id,
          displayName:
            requestPeer.peerInfo.displayName || 'peer - ' + requestPeer.id,
          device: requestPeer.data.device,
          isGuest: requestPeer.peerInfo.isGuest,
          isHost: requestPeer.peerInfo.isHost,
          avatarUrl: requestPeer.peerInfo.avatarUrl,
        },
      });

      return true;
    } catch (error) {
      console.log('requestRecord ERROR: ', error);
      return false;
    }
  }

  @rpcMethod
  protected async stopRecord(payload: any) {
    try {
      const { peerId } = payload;

      console.log('requestStopPeer PeerId: ', peerId);
      const requestStopPeer = this.peers.get(peerId);

      // not logged in user can't stop record
      if (!requestStopPeer?.peerInfo?.userId) {
        throw new UnauthorizedException();
      }
      if (!this.recorder) {
        throw new UnauthorizedException();
      }
      this.handleStopRecordComposeAndSendMail();

      // emit socket stopRecord to all member of the room
      this.broadcast('notification', {
        method: 'stopRecording',
        data: {
          id: requestStopPeer.id,
          displayName:
            requestStopPeer.peerInfo.displayName ||
            'peer - ' + requestStopPeer.id,
          device: requestStopPeer.data.device,
          isGuest: requestStopPeer.peerInfo.isGuest,
          isHost: requestStopPeer.peerInfo.isHost,
          avatarUrl: requestStopPeer.peerInfo.avatarUrl,
        },
      });

      return true;
    } catch (error) {
      console.log('stopRecord ERROR: ', error);
      return false;
    }
  }

  private handleStopRecord() {
    for (const process of this.recorder.processes.values()) {
      process.kill();
    }

    for (const transport of this.recorder.transports.values()) {
      transport.close();
    }

    // Release ports from port set
    for (const remotePort of this.recorder.remotePorts) {
      releasePort(remotePort);
    }

    const outputScriptPath = `${config.recorder.outputDir}/${this.id}/script.json`;
    // write the script file
    writeFileSync(
      outputScriptPath,
      JSON.stringify(this.recorder.script, null, 2),
      'utf-8',
    );

    this.recorder = null;

    return outputScriptPath;
  }

  public override removePeer(peerId: string) {
    super.removePeer(peerId);

    if (this.recorder?.peerId == peerId) {
      this.handleStopRecordComposeAndSendMail();

      // emit socket stopRecord to all member of the room
      this.broadcast('notification', {
        method: 'stopRecording',
        data: {
          id: peerId,
        },
      });
    }
  }

  public override close() {
    super.close();

    if (this.recorder) {
      this.handleStopRecordComposeAndSendMail();
    }
  }

  private handleStopRecordComposeAndSendMail() {
    const recorderUserId = this.recorder.script?.recorder?.userId;
    const outputScript = this.handleStopRecord();

    // wait 10 seconds before composing for ffmpeg finishes writing files
    setTimeout(() => {
      compose(outputScript).then(() => {
        // send mail finish video processing
        void this.sendMailRecordFinish(recorderUserId);
        console.log(`Compose record finished -  room ${this.id}!`);
      });
    }, 10000);

    // Function send email record processing
    void this.sendMailRecord(MeetingRecordType.PROCESSING, recorderUserId);

    console.log(`Recording stop - room ${this.id}!`);
  }

  private async sendMailRecordFinish(recorderUserId: string) {
    const recordLink = process.env.API_DOMAIN + 'records/' + this.id + '.mp4';
    await this.sendMailRecord(
      MeetingRecordType.FINISHED,
      recorderUserId,
      recordLink,
    );
  }

  private async sendMailRecord(
    type: MeetingRecordType,
    recorderUserId: string,
    recordLink?: string,
  ) {
    try {
      const meetingRoom = await this.prismaService.room.findFirst({
        where: { id: this.id },
      });
      if (!meetingRoom) return;

      const userHost = await this.prismaService.user.findFirst({
        where: { id: meetingRoom.creatorId },
      });
      let toEmails = userHost.email;

      if (recorderUserId) {
        const userRecord = await this.prismaService.user.findFirst({
          where: { id: Number(recorderUserId) },
        });

        if (userRecord?.email) toEmails += ',' + userRecord.email;
      }

      if (toEmails) {
        const date = getFormattedDate(meetingRoom.startTime);
        const meetingRecordEmailContext: MeetingRecordEmailContext = {
          to: toEmails,
          meetingName: meetingRoom.name,
          date,
          recordLink,
        };
        if (type === 'processing') {
          await this.mailService.sendEmailMeetingRecordProcessing(
            meetingRecordEmailContext,
          );
        } else if (type === 'finished') {
          await this.mailService.sendEmailMeetingRecordFinish(
            meetingRecordEmailContext,
          );
        }
      }
    } catch (error) {
      console.log(`sendMailRecord ${this.id} room ERROR: `, error);
    }
  }

  private async handleStartRecord(peerId: string) {
    const peer = this.getPeer(peerId);

    this.recorder = {
      peerId,
      transports: new Map<string, PlainTransport>(),
      remotePorts: [],
      processes: new Map<string, FFmpeg>(),
      script: {
        meeting_id: this.id,
        start_time: Date.now().toString(),
        recorder: {
          name: peer.data.displayName,
          userId: peer.peerInfo.userId,
        },
        videos: [],
        audios: [],
        screens: [],
      },
    };

    const videoProducer = Array.from(peer.data.producers.values()).find(
      (producer) => producer.kind === 'video',
    );
    const audioProducer = Array.from(peer.data.producers.values()).find(
      (producer) => producer.kind === 'audio',
    );

    if (videoProducer) {
      await this.publishProducerRtpStream(videoProducer, 'video');
    }

    if (this.presenter) {
      const presenterPeer = this.peers.get(this.presenter.peerId);
      if (presenterPeer) {
        const presenterProducer = presenterPeer.data.producers.get(
          this.presenter.producerId,
        );
        if (presenterProducer)
          await this.publishProducerRtpStream(presenterProducer, 'video', true);
      }
    }

    if (audioProducer) {
      await this.publishProducerRtpStream(audioProducer, 'audio');
    }
  }

  private async createLocalTransport(rtpPort: number, rtcpPort: number) {
    const transport = await this.router.createPlainTransport({
      rtcpMux: false,
      ...config.recorder.transport,
    });

    await transport.connect({
      ip: config.recorder.target.ip,
      port: rtpPort,
      rtcpPort: rtcpPort,
    });

    return transport;
  }

  private async publishProducerRtpStream(
    producer: Producer,
    type: 'audio' | 'video',
    isScreen = false,
  ) {
    const port = await getPort();
    const rtcpPort = await getPort();

    this.recorder.remotePorts.push(port, rtcpPort);

    const transport = await this.createLocalTransport(port, rtcpPort);
    // const transport = this.recorder.videoTransport;

    const codecs = [];
    // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
    const routerCodec = this.router.rtpCapabilities.codecs.find(
      (codec) => codec.kind === type,
    );
    codecs.push(routerCodec);

    const rtpCapabilities = {
      codecs,
      rtcpFeedback: [],
    };

    // Start the consumer paused
    // Once the gstreamer process is ready to consume resume and send a keyframe
    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true,
    });

    let outputFile: string;
    const ffmpegProcess = new FFmpeg(this.id);
    if (type === 'video') {
      outputFile = ffmpegProcess._createVideoRecorder(port);
      if (isScreen) {
        this.recorder.script.screens.push(outputFile);
        this.recorder.screenConsumer = consumer;
      } else {
        this.recorder.script.videos.push(outputFile);
        this.recorder.videoConsumer = consumer;
      }
    } else {
      outputFile = ffmpegProcess._createAudioRecorder(port);
      this.recorder.script.audios.push(outputFile);
      this.recorder.audioConsumer = consumer;
    }

    const processKey = isScreen ? 'screen' : type;
    this.recorder.processes.set(processKey, ffmpegProcess);
    this.recorder.transports.set(transport.id, transport);

    setTimeout(async () => {
      if (consumer) {
        await consumer.resume();
        await consumer.requestKeyFrame();
      }
    }, 1000);

    consumer.on('producerclose', () => {
      console.log('---- producerclose -----');
      console.log(producer.id, transport.id, processKey);
      console.log('---- producerclose -----');
      this.recorder.processes.get(processKey).kill();
      this.recorder.transports.get(transport.id).close();
      consumer.close();
    });

    return {
      consumerId: consumer.id,
      remoteRtpPort: port,
      remoteRtcpPort: rtcpPort,
      localRtcpPort: transport.rtcpTuple
        ? transport.rtcpTuple.localPort
        : undefined,
      rtpCapabilities,
      rtpParameters: consumer.rtpParameters,
    };
  }
}

export default MeetingRoom;
