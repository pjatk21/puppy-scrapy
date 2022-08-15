import { Logger } from 'pino'
import type { ScheduleEntry } from './types'
import got, { Got } from 'got'

/**
 * @deprecated HTTP upload is no longer supported. Use the bridge instead.
 */
export class Uploader {
  private readonly base: URL
  private readonly got: Got
  log?: Logger

  constructor(baseApi: string | URL, uploadKey: string) {
    this.base = typeof baseApi === 'string' ? new URL(baseApi) : baseApi
    this.got = got.extend({
      prefixUrl: this.base,
      headers: {
        'X-Upload-key': uploadKey,
      },
    })
  }

  async uploadEntries(entries: ScheduleEntry[], forDate: string) {
    this.log?.debug('Uploading ' + entries.length + ' entries')
    const response = await this.got
      .post('timetable/upload/' + forDate, { json: entries })
      .json()
    this.log?.info(response)
    return response
  }
}
