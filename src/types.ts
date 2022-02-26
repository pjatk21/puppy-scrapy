import { DateTime } from 'luxon'

export enum DateFormats {
  dateYMD = 'yyyy-MM-dd',
  dateDMYHMS = 'dd.MM.yyyy HH:mm:ss',
}

export type ScheduleEntry = {
  begin: DateTime
  end: DateTime
  raw: {
    groups: string
    date: string
    begin: string
    end: string
  }
  name: string
  code: string
  tutor: string | null
  building: string
  room: string
  type: string
  groups: string[]
}
