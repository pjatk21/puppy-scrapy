#!/usr/bin/env node --experimental-specifier-resolution=node
import { DateTime } from 'luxon'
import pino from 'pino'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { getBrowser } from '.'
import { PublicScheduleScrapper } from './scrapper/public'
import { DateFormats } from './types'
import 'dotenv/config'
import { writeFileSync } from 'fs'
import { ScrapperEvent } from './scrapper/base'
import { WorkerManager } from './manager'

yargs(hideBin(process.argv))
  .option('api', {
    description: 'URL for API, can be set by env ALTAPI_URL.',
    default: process.env.ALTAPI_URL ?? 'https://altapi.kpostek.dev/v1',
  })
  .option('uploadKey', {
    description:
      'Key required to upload to an API, can be set by env ALTAPI_UPLOAD_KEY',
    default: process.env.ALTAPI_UPLOAD_KEY,
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

          activeScrapper.on(ScrapperEvent.FETCH, (htmlId, context) =>
            console.log(htmlId, context)
          )

          const entries = await activeScrapper.getData()
          loopLogger.info(
            'Scrapped %d entries for day %s',
            entries.length,
            date.toISODate()
          )

          if (saveToJSON)
            writeFileSync(
              `uploadPayload-${date}.json`,
              JSON.stringify(entries, undefined, 2)
            )
        }
      } while (!once)

      process.exit()
    }
  )
  .command(
    'worker',
    'Run scrapper in worker mode (managed by hypervisor)',
    (yargs) => yargs.option('limit', { type: 'number' }),
    async ({ limit }) => {
      const browser = await getBrowser()
      const workerLogger = pino()
      const manager = new WorkerManager(browser, workerLogger, {
        gateway: 'ws://localhost:4000',
      })
      manager.start()
    }
  )
  .showHelpOnFail(true)
  .demandCommand()
  .strictCommands()
  .strictOptions()
  .parse()
