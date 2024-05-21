import { IRecordInfo } from '../../wss.interfaces';

export function createVideoSdpText(port: number) {
  return [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=FFmpeg',
    'c=IN IP4 127.0.0.1',
    't=0 0',
    `m=video ${port} RTP/AVP 101`,
    'a=rtpmap:101 VP8/90000',
    'a=sendonly',
  ].join('\n');
}

export function createAudioSdpText(port: number) {
  return [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=FFmpeg',
    'c=IN IP4 127.0.0.1',
    't=0 0',
    `m=audio ${port} RTP/AVP 100`,
    'a=rtpmap:100 opus/48000/2',
    'a=sendonly',
  ].join('\n');
}
