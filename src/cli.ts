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

yargs(hideBin(process.argv))
  .option('api', {
    'description': 'URL for API, can be set by env var ALTAPI_URL.',
    default: process.env.ALTAPI_URL ?? 'https://altapi.kpostek.dev',
  })
  .command(
    'run',
    'Just for dev purposes',
    (yargs) => yargs.option('limit', { type: 'number' }),
    async ({ limit, api }) => {
      const pss = new PublicScheduleScrapper(
        await getBrowser(),
        {
          setDate: DateTime.fromFormat('2022-03-07', DateFormats.dateYMD),
          limit: limit,
        },
        pino({ level: 'debug' })
      )
      const d = (await pss.getData()) as ScheduleEntry[]
      console.log(JSON.stringify(d, undefined, 2))
      try {
        await new Uploader(api).uploadEntries(
          d,
          '2022-03-07'
        )
      } catch (e) {
        pino().error(e)
      }

      process.exit()
    }
  )
  .showHelpOnFail(true)
  .demandCommand()
  .strictCommands()
  .parse()
