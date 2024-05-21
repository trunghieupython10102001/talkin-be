export interface IScript {
  meeting_id: string;
  start_time: string,
  end_time: string,
  recorder: {
    id: string;
    name: string;
    avatar?: string;
  },
  videos: string[];
  audios: string[];
  screens: string[];
}
