import { RtpParameters } from 'mediasoup/node/lib/RtpParameters';
import { Readable } from 'stream';

export function convertStringToStream(stringToConvert: string) {
  const stream = new Readable();
  stream.push(stringToConvert);
  stream.push(null);

  return stream;
}

export function getCodecInfoFromRtpParameters(
  kind: string,
  rtpParameters: RtpParameters,
) {
  return {
    payloadType: rtpParameters.codecs[0].payloadType,
    codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ''),
    clockRate: rtpParameters.codecs[0].clockRate,
    channels: kind === 'audio' ? rtpParameters.codecs[0].channels : undefined,
  };
}
