import { existsSync, mkdirSync } from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

import { createVideoSdpText, createAudioSdpText } from './sdp';
import { convertStringToStream } from './utils';
import * as config from 'config';

export class FFmpeg {
  private _process: ChildProcess;
  private _observer: EventEmitter;
  private _outputDir: string;

  constructor(meetingId: string) {
    this._process = undefined;
    this._observer = new EventEmitter();
    this._outputDir = `${config.recorder.outputDir}/${meetingId}`;

    // create outputDir if not existed
    if (!existsSync(this._outputDir)) {
      mkdirSync(this._outputDir);
    }
  }

  getNow() {
    return Date.now().toString();
  }

  _createVideoRecorder(port: number) {
    const now = this.getNow();
    const outputPath = `${this._outputDir}/${now}.webm`;
    let commandArgs = [
      '-loglevel',
      'debug',
      '-protocol_whitelist',
      'pipe,udp,rtp',
      '-fflags',
      '+genpts',
      '-f',
      'sdp',
      '-i',
      'pipe:0',
    ];
    commandArgs = commandArgs.concat(this._videoArgs);
    commandArgs = commandArgs.concat([outputPath]);
    this._createProcess(createVideoSdpText(port), commandArgs);
    return outputPath;
  }

  _createAudioRecorder(port: number) {
    const now = this.getNow();
    const outputPath = `${this._outputDir}/${now}.wav`;
    let commandArgs = [
      '-loglevel',
      'debug',
      '-protocol_whitelist',
      'pipe,udp,rtp',
      '-fflags',
      '+genpts',
      '-f',
      'sdp',
      '-i',
      'pipe:0',
    ];
    commandArgs = commandArgs.concat(this._audioArgs);
    commandArgs = commandArgs.concat([outputPath]);
    this._createProcess(createAudioSdpText(port), commandArgs);

    return outputPath;
  }

  _createProcess(sdpString: string, commandArgs: string[]) {
    const sdpStream = convertStringToStream(sdpString);

    this._process = spawn('ffmpeg', commandArgs);

    if (this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');

      this._process.stderr.once('data', (data) =>
        console.log('ffmpeg::process::stderr_data [data:%o]', data),
      );
      // for debug purpose
      this._process.stderr.on('data', (data) =>
        console.log('ffmpeg::process::data [data:%o]', data),
      );
    }

    if (this._process.stdout) {
      this._process.stdout.setEncoding('utf-8');

      this._process.stdout.once('data', (data) =>
        console.log('ffmpeg::process::stdout_data [data:%o]', data),
      );

      // for debug purpose
      this._process.stdout.on('data', (data) =>
        console.log('ffmpeg::process::data [data:%o]', data),
      );
    }

    // for debug purpose
    this._process.on('message', (message) =>
      console.log('ffmpeg::process::message [message:%o]', message),
    );

    this._process.on('error', (error) =>
      console.error('ffmpeg::process::error [error:%o]', error),
    );

    this._process.once('close', () => {
      console.log('ffmpeg::process::close');
      this._observer.emit('process-close');
    });

    sdpStream.on('error', (error) =>
      console.error('sdpStream::error [error:%o]', error),
    );

    // Pipe sdp stream to the ffmpeg process
    sdpStream.resume();
    sdpStream.pipe(this._process.stdin);
  }

  get id() {
    return this._process.pid;
  }

  kill() {
    console.log('kill() [pid:%d]', this._process.pid);
    this._process.kill('SIGINT');
  }

  get _videoArgs() {
    // return ["-vf", "select='isnan(prev_selected_t)+gte(t-prev_selected_t,1)'"]
    return ['-map', '0:v:0', '-c:v', 'copy'];
  }

  get _audioArgs() {
    return [
      '-af',
      'aresample=async=1',
      '-map',
      '0:a:0',
      '-strict', // libvorbis is experimental
      '-2',
    ];
  }
}
