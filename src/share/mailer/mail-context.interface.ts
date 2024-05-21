export interface MailContext {
  to: string;
}

export interface MeetingEmailContext extends MailContext {
  meetingName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  description?: string;
  meetingLink: string;
  meetingId: string;
}

export interface LivestreamScheduleEmailContext extends MailContext {
  livestreamName: string;
  date: string;
  startTime: string;
  description?: string;
  livestreamLink: string;
  category: string[];
}

export interface LivestreamInstantEmailContext extends MailContext {
  livestreamName: string;
  description?: string;
  livestreamLink: string;
  category: string[];
}

export interface MeetingRecordEmailContext extends MailContext {
  meetingName?: string;
  date: string;
  recordLink?: string;
}
