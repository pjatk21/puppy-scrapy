#!/usr/bin/env node --experimental-specifier-resolution=node
import { DateTime } from 'luxon'
import pino from 'pino'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { getBrowser } from '.'
import { PublicScheduleScrapper } from './scrapper/public'
import { DateFormats, ScheduleEntry } from './types'
import { Uploader } from './uploader'
import 'dotenv/config'
import { writeFileSync } from 'fs'

yargs(hideBin(process.argv))
  .option('api', {
    description: 'URL for API, can be set by env ALTAPI_URL.',
    default: process.env.ALTAPI_URL ?? 'https://altapi.kpostek.dev',
  })
  .option('uploadKey', {
    description:
      'Key required to upload to an API, can be set by env ALTAPI_UPLOADKEY',
    default: process.env.ALTAPI_UPLOADKEY,
  })
  .command(
    'loop',
    'Main loop for scrapper.',
    (yargs) =>
      yargs
        .option('limit', { type: 'number' })
        .option('date', {
          type: 'string',
          default: DateTime.local().toFormat(DateFormats.dateYMD),
        })
        .option('saveToJSON', { type: 'boolean', default: false })
        .option('loopSize', { type: 'number', default: 21 })
        .option('loopInterval', { type: 'number', default: 3600 })
        .option('loopDelay', { type: 'number', default: 10 })
        .option('once', { type: 'boolean', default: false })
        .option('skipUpload', { type: 'boolean', default: false }),
    async ({
      limit,
      api,
      uploadKey,
      date,
      saveToJSON,
      once,
      loopSize,
      skipUpload,
      loopDelay,
      loopInterval,
    }) => {
      const browser = await getBrowser()
      const loopLogger = pino()

      do {
        const dates = Array.from(Array(loopSize).keys()).map((n) => {
          return DateTime.fromFormat(date, DateFormats.dateYMD).plus({
            days: n,
          })
        })
        loopLogger.info(dates.map((d) => d.toISODate()))

        for (const date of dates) {
          loopLogger.info('Start scrapping %s', date.toISODate())
          const activeScrapper = new PublicScheduleScrapper(
            browser,
            {
              setDate: date,
              timeout: 25_000,
            },
            loopLogger
          )
          const entries = (await activeScrapper.getData()) as ScheduleEntry[]
          loopLogger.info('Scrapped %d entries for day %s', entries.length, date.toISODate())

          if (saveToJSON)
            writeFileSync(
              `uploadPayload-${date}.json`,
              JSON.stringify(entries, undefined, 2)
            )

          if (!skipUpload) {
            try {
              if (uploadKey)
                await new Uploader(api, uploadKey).uploadEntries(
                  entries,
                  date.toFormat(DateFormats.dateYMD)
                )
              else throw new Error('No upload key present!')
            } catch (e) {
              loopLogger.error(e)
            }
          } else {
            loopLogger.info('Upload skipped!')
          }

          loopLogger.info('%ss delay', loopDelay)
          await new Promise((resolve) => setTimeout(resolve, loopDelay * 1000))
        }
        loopLogger.info('%ss interval pause', loopInterval)
        await new Promise((resolve) => setTimeout(resolve, loopInterval * 1000))
      } while (!once)

      process.exit()
    }
  )
  .showHelpOnFail(true)
  .demandCommand()
  .strictCommands()
  .strictOptions()
  .parse()
