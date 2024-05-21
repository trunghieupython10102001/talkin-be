const { join } = require('path');

module.exports = {
  logger: {
    level: 'debug',
  },
  recorder: {
    outputDir: join(__dirname, '../records'),
    target: { ip: '127.0.0.1' },
    transport: {
      listenIp: { ip: '127.0.0.1', announcedIp: null },
    },
  },
  app: {
    sslCrt: '',
    sslKey: '',
  },
  cors: {
    allowedOrigins: [],
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
    allowedCredentials: false,
    allowedHeaders: [
      'Content-Type',
      'Content-Language',
      'Authorization',
      'X-Authorization',
      'Origin',
      'Accept',
      'Accept-Language',
    ],
  },
  mediasoup: {
    workerPool: 3,
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },
    webRtcServer: {
      listenInfos: [
        {
          protocol: 'udp',
          ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '0.0.0.0',
          port: 44444,
        },
        {
          protocol: 'tcp',
          ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '0.0.0.0',
          port: 44444,
        },
      ],
    },

    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '0.0.0.0',
        },
      ],
      initialAvailableOutgoingBitrate: 100000,
      minimumAvailableOutgoingBitrate: 15000,
      maximumAvailableOutgoingBitrate: 200000,
      factorIncomingBitrate: 0.75,
    },
  },
};
