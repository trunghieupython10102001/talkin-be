import Media from './Media'
import PresenterLayout from './layouts/Presenter'

export default class Step {
  public readonly id: string
  public readonly mediaList: Media[]
  public readonly startTime: number
  public readonly duration: number
  public readonly size: Size
  public readonly displayName?: string
  private readonly layout: PresenterLayout

  constructor(id: string, mediaList: Media[], startTime: number, endTime: number, size: Size, displayName?: string) {
    this.id = id
    this.mediaList = mediaList
    this.startTime = startTime
    this.duration = endTime - startTime
    this.size = size
    this.layout = new PresenterLayout()
    this.displayName = displayName ? displayName.substring(0, 12) : id
  }

  generateFilter(): string {
    /**
     * this is the most important part
     *
     * the basic concept is:
     * 1. We draw a blank screen (canvas) with given size then draw overlay
     *    screen video and cam video
     * 2. Check if there is a screen sharing in this step
     *    2.1 if yes draw that video screen with 3/4 width and the cam video
     *      with 1/4 of width
     *    2.2 if no draw the cam video with 100% of size
     * 3. Check if there is a cam video in this step
     *    3.1 if yes: do nothing
     *    3.2 if no: create a fake video with username in the center of screen
     *      -> this will be using as a cam video
     *
     */
    const videoList = this.mediaList.filter(media => media.hasVideo)

    // if there is a screen move it to head
    const screenIdx = videoList.findIndex(media => media.isScreen)
    if (screenIdx >= 0) {
      const mediaScreen = videoList[screenIdx];
      videoList.splice(screenIdx, 1)
      videoList.unshift(mediaScreen);
    }

    // init screen
    const out: string[] = []
    out.push(`color=s=${this.size.w}x${this.size.h},trim=0:${this.duration / 1000}[${this.id}_bg];`)


    // ╭──────────────────────────────────────────────────────────╮
    // │                     VIDEO PROCESSING                     │
    // ╰──────────────────────────────────────────────────────────╯
    // if there is a screen video
    if (screenIdx >= 0) {
      const vid = videoList[0]
      const screenBox = this.layout.getScreenBox(this.size)
      const box = this.layout.getCamBox(this.size);

      // trim and scale screen video with 3/4 of width
      out.push(`[${vid.id}:v]trim=${(this.startTime - vid.startTime) / 1000}:${(this.duration + this.startTime - vid.startTime) / 1000 },setpts=PTS-STARTPTS,`)
      out.push(`scale=w='if(gt(iw/ih,${screenBox.w}/(${screenBox.h})),${screenBox.w},-2)':h='if(gt(iw/ih,${screenBox.w}/(${screenBox.h})),-2,${screenBox.h})':eval=init[${this.id}_0_v];`)


      // if there is a cam video
      // shrink it to 1/4 width
      if (videoList.length > 1) {
        const camVid = videoList[1]
        out.push(`[${camVid.id}:v]trim=${(this.startTime - camVid.startTime) / 1000}:${(this.duration + this.startTime - camVid.startTime) / 1000 },setpts=PTS-STARTPTS,`)
        out.push(`scale=w='if(gt(iw/ih,${box.w}/(${box.h})),${box.w},-2)':h='if(gt(iw/ih,${box.w}/(${box.h})),-2,${box.h})':eval=init[${this.id}_1_v];`)
      } else {
        // if there is no cam video -> create a fake video with username in the
        // center of video -> this will be using as a video cam
        out.push(`color=s=${this.size.w}x${this.size.h}:c=#262626@1.0,trim=0:${this.duration / 1000},drawtext=text='${this.displayName}':x=(w-tw)/2:y=((h-th)/2):fontcolor=white:fontsize=55,`)
        out.push(`scale=w='if(gt(iw/ih,${box.w}/(${box.h})),${box.w},-2)':h='if(gt(iw/ih,${box.w}/(${box.h})),-2,${box.h})':eval=init[${this.id}_1_v];`)
      }

      // overlay screen video
      out.push(`[${this.id}_bg][${this.id}_0_v]overlay=x='(${screenBox.w}-w)/2+${screenBox.x}':y='(${screenBox.h}-h)/2+${screenBox.y}':eval=init:shortest=1[${this.id}_overlay_1];`)

      // overlay cam video
      out.push(`[${this.id}_overlay_1][${this.id}_1_v]overlay=x='(${box.w}-w)/2+${box.x}':y='(${box.h}-h)/2+${box.y}':eval=init:shortest=1[${this.id}_out_v];`)
    }
    else if (videoList.length === 1) {
      // if there is no screen video and has at least one cam video -> make the
      // cam video full width
      const vid = videoList[0]
      const box = { w: this.size.w, h: this.size.h, x: 0, y:0 }
      out.push(`[${vid.id}:v]trim=${(this.startTime - vid.startTime) / 1000}:${(this.duration + this.startTime - vid.startTime) / 1000 },setpts=PTS-STARTPTS,`)
      out.push(`scale=w='if(gt(iw/ih,${box.w}/(${box.h})),${box.w},-2)':h='if(gt(iw/ih,${box.w}/(${box.h})),-2,${box.h})':eval=init[${this.id}_0_v];`)

      out.push(`[${this.id}_bg][${this.id}_0_v]overlay=x='(${box.w}-w)/2+${box.x}':y='(${box.h}-h)/2+${box.y}':eval=init:shortest=1[${this.id}_out_v];`)
    } 
    else if (videoList.length === 0) {
      // if there is no video (screen and cam) -> create a fake video for cam
      // video
      const box = { w: this.size.w, h: this.size.h, x: 0, y:0 }
      out.push(`color=s=${this.size.w}x${this.size.h}:c=#262626@1.0,trim=0:${this.duration / 1000},drawtext=text='${this.displayName}':x=(w-tw)/2:y=((h-th)/2):fontcolor=white:fontsize=55,`)
      out.push(`scale=w='if(gt(iw/ih,${box.w}/(${box.h})),${box.w},-2)':h='if(gt(iw/ih,${box.w}/(${box.h})),-2,${box.h})':eval=init[${this.id}_0_v];`)

      // draw the output with label [this.id_0_v] overlay the initial canvas
      out.push(`[${this.id}_bg][${this.id}_0_v]overlay=x='(${box.w}-w)/2+${box.x}':y='(${box.h}-h)/2+${box.y}':eval=init:shortest=1[${this.id}_out_v];`)
    }

    // ╭──────────────────────────────────────────────────────────╮
    // │                        TRIM AUDIO                        │
    // ╰──────────────────────────────────────────────────────────╯
    const audioList = this.mediaList.filter(media => media.hasAudio)
    audioList.forEach(vid => {
      out.push(`[${vid.id}:a]atrim=${(this.startTime - vid.startTime) / 1000}:${(this.duration + this.startTime - vid.startTime) / 1000 },asetpts=PTS-STARTPTS[${this.id}_${vid.id}_a];`)
    })

    // ╭──────────────────────────────────────────────────────────╮
    // │                        MIX AUDIO                         │
    // ╰──────────────────────────────────────────────────────────╯
    const inputList = audioList.map(vid => `[${this.id}_${vid.id}_a]`).join('')


    let c0:string = ''
    let c1:string = ''
    let currentIndex:number = 0
    audioList.forEach((vid, ind) => {
      const plus:string = ind===audioList.length -1?'':'+'
      if(vid.audioChannels === 6) {
        c0 += `0.4*c${currentIndex}+0.6*c${currentIndex+2}${plus}`
        c1 += `0.4*c${currentIndex+1}+0.6*c${currentIndex+2}${plus}`
      } else {
        c0 += `c${currentIndex}${plus}`
        c1 += `c${currentIndex+1}${plus}`
      }
      currentIndex += vid.audioChannels
    })
    if(audioList.length > 0) {
      out.push(`${inputList}amerge=inputs=${audioList.length},pan='stereo|c0<${c0}|c1<${c1}'[${this.id}_out_a];`)
    } else {
      // TODO what sample rate to choose? Maybe need to convert all sample rates of files before concat
      out.push(`anullsrc=r=48000:cl=stereo,atrim=0:${this.duration / 1000 },asetpts=PTS-STARTPTS[${this.id}_out_a];`)
    }

    return out.join('')
  }
}
