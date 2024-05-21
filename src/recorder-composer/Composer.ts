import * as config from 'config';
import { basename } from 'path';
import { readFileSync } from 'fs';
import { IScript } from './IScript';
import Media, { IMediaParams } from './Media';
import { MediaPoint } from './IMediaPoint';
import Step from './Step';
import CommandExecutor from './CommandExecutor';

class Composer {
  private initScript: IScript;
  private encodingOptions: EncodingOptions
  private outputDir: string;


  constructor(scriptFile: string, encOpt?: EncodingOptions) {
    const data = readFileSync(scriptFile, 'utf-8');
    this.outputDir = config.recorder.outputDir;
    this.initScript = JSON.parse(data);

    // allow user customize encoding options
    const defaultEncodingOptions: EncodingOptions = {
      size: { w: 1280, h: 720 },
      crf: 22
    }

    const encoding: EncodingOptions = {
      size: encOpt ? encOpt.size : defaultEncodingOptions.size,
      loglevel: encOpt?.loglevel
    }

    if (!encOpt?.crf && !encOpt?.bitrate) {
      encoding.crf = defaultEncodingOptions.crf
    } else {
      encoding.crf = encOpt?.crf
      encoding.bitrate = encOpt?.bitrate
    }

    this.encodingOptions = encoding
  }

  get startTime() {
    let firstVidTimestamp = Infinity, firstScreenTimestamp = Infinity, firstAudioTimestamp = Infinity;

    if (this.initScript.videos.length) firstVidTimestamp = this.getTimestamp(this.initScript.videos[0]);
    if (this.initScript.audios.length) firstAudioTimestamp = this.getTimestamp(this.initScript.audios[0]);
    if (this.initScript.screens.length) firstScreenTimestamp = this.getTimestamp(this.initScript.videos[0]);

    return Math.min(firstVidTimestamp, firstScreenTimestamp);
  }

  private getTimestamp(filePath: string): number {
    const filename = basename(filePath);
    return Number.parseInt(filename.split(".")[0]);
  }

  _initMedias(mediaPaths: string[], params: IMediaParams): Media[] {
    const medias = []
    for (const mediaPath of mediaPaths) {
      // calculate the start time of this file
      const timestamp = this.getTimestamp(mediaPath);
      const startTime = timestamp - this.startTime;
      medias.push(new Media(
        mediaPath,
        startTime,
        { ...params, user: this.initScript.recorder }
      ));
    }

    return medias;
  }

  async loadMedias() {
    const videos = this._initMedias(this.initScript.videos, { hasVideo: true });
    const audios = this._initMedias(this.initScript.audios, { hasAudio: true });
    const screens = this._initMedias(this.initScript.screens, { hasVideo: true, isScreen: true });

    // init all media files so we can get the duration and channel info
    await Promise.all([
      ...videos.map(m => m.init()),
      ...audios.map(m => m.init()),
      ...screens.map(m => m.init()),
    ])

    const medias = [...videos, ...screens, ...audios];
    // sort media files by startTime
    medias
      .sort((a, b) => a.startTime - b.startTime)
      .forEach((vid, index) => vid.setId(index))

    return medias;
  }

  private initTimeline(medias: Media[]): MediaPoint[] {
    const queue: MediaPoint[] = [];
    medias.forEach(vid => {
      queue.push({
        start_point: true,
        time: vid.startTime,
        media_id: vid.id
      })

      queue.push({
        start_point: false,
        time: vid.startTime + vid.duration,
        media_id: vid.id
      })
    })

    queue.sort((a, b) => a.time - b.time);
    return queue;
  }

  private createSteps(queue: MediaPoint[], medias: Media[]): Step[] {
    const steps: Step[] = []
    const currentVideos: Media[] = []
    let prevTime = -1

    while (queue.length > 0) {
      const point = queue.shift();
      if ((queue.length === 0 || point!.time !== prevTime) && prevTime !== -1 && currentVideos.length >= 0) {
        const step = new Step(
          `Seq${steps.length}`,
          [...currentVideos],
          prevTime,
          point!.time,
          this.encodingOptions.size,
          this.initScript.recorder.name,
        )
        steps.push(step);
      }

      if (point?.start_point) currentVideos.push(medias[point.media_id])
      else {
        const index = currentVideos.findIndex(vid => vid.id === point?.media_id)
        currentVideos.splice(index, 1)
      }

      prevTime = point!.time
    }

    console.log('\n---- Videos ----')
    medias.forEach(vid => console.log('id', vid.id, 'start', vid.startTime, 'len', vid.duration, 'achan', vid.audioChannels, vid.path))
    console.log('\n---- Sequences ----')
    steps.forEach(step => {
      console.log(step.id, 'v:', '[' + step.mediaList.map(vid => vid.id.toString()).join(',') + ']', 'start', step.startTime, 'end', step.startTime + step.duration, 'len', step.duration)
    })

    console.log('after run initTimeline')
    return steps;
  }

  async generateCommand(steps: Step[], medias: Media[]): Promise<string[]> {
    const command: string[] = []

    console.log('============== steps=========', steps)
    const logging: string = this.encodingOptions.loglevel ? `-v ${this.encodingOptions.loglevel}` : `-v quiet -stats`

    command.push(`ffmpeg ${logging} `)
    command.push(medias.map(video => `-i "${video.path}"`).join(' ') + ' ')
    command.push(`-filter_complex_script `)
    command.push('pipe:0 ')
    const quality: string = this.encodingOptions.crf ? `-crf ${this.encodingOptions.crf}` : `-b:v ${this.encodingOptions.bitrate}`
    command.push(`-c:v libx264 ${quality} -preset fast -map [vid] -map [aud] -y "${this.outputDir}/${this.initScript.meeting_id}.mp4"`)

    const filter: string[] = []
    filter.push(`${steps.map(step => step.generateFilter()).join('')}`)
    filter.push(`${steps.map(step => `[${step.id}_out_v][${step.id}_out_a]`).join('')}concat=n=${steps.length}:v=1:a=1[vid][aud]`)

    return Promise.all([filter.join(''), command.join('')])
  }

  async encode(): Promise<any> {
    try {
      const medias = await this.loadMedias();
      const timeline = this.initTimeline(medias);
      const steps = this.createSteps(timeline, medias);

      const [filter, command] = await this.generateCommand(steps, medias);
      return CommandExecutor.pipeExec(filter, command, true)
    } catch (error) {
      console.error(error)
    }
  }
}

export default Composer;
