import Composer from './Composer'

const encodingOptions: EncodingOptions = {
  crf: 20,
  loglevel: 'verbose',
  size:{
    w: 1280,
    h: 720
  }
}

export function compose(scriptLink: string) {
  const c = new Composer(scriptLink, encodingOptions);
  return c.encode();
}
