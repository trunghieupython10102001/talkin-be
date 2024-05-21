// Port used for the ffmpeg process to receive RTP from mediasoup
const MIN_PORT = 20000;
const MAX_PORT = 30000;

const takenPortSet = new Set<number>();

export async function getPort() {
  let port = getRandomPort();

  while (takenPortSet.has(port)) {
    port = getRandomPort();
  }

  takenPortSet.add(port);

  return port;
}

export function releasePort(port: number) {
  takenPortSet.delete(port);
}

export const getRandomPort = () =>
  Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1) + MIN_PORT);

