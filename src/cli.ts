#!/usr/bin/env node --experimental-specifier-resolution=node
import { DateTime } from 'luxon'
import pino from 'pino'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { getBrowser } from '.'
import { PublicScheduleScrapper } from './scrapper/public'
import { DateFormats } from './types'
import 'dotenv/config'
import { existsSync, writeFileSync } from 'fs'
import { ScrapperEvent } from './scrapper/base'
import { WorkerManager } from './manager'
import { Manager } from 'socket.io-client'
import { Keychain } from './keychain'

const cliLogger =
  process.env.NODE_ENV === 'production'
    ? pino()
    : pino({
        transport: {
          target: 'pino-pretty',
          options: { translateTime: true },
        },
      })

yargs(hideBin(process.argv))
  .option('api', {
    description: 'URL for API, can be set by env ALTAPI_URL.',
    default: process.env.ALTAPI_URL ?? 'https://altapi.kpostek.dev/v1',
  })
  .command(
    'init',
    'Create required files before first run',
    (yargs) =>
      yargs
        .option('ignore', {
          description: 'Ignore if everything is as it should be.',
          type: 'boolean',
        })
        .option('force', { description: 'Always overwrite.', type: 'boolean' })
        .option('name', { description: 'Name of scrapper.', type: 'string' }),
    ({ ignore, force, name }) => {
      if (ignore && force) throw new Error("You can't pass both flags!")

      if (existsSync('identity.json')) {
        if (ignore) console.debug('Identity already exitst! Ignoring...')
        else if (force) {
          console.debug('Overwritting identity...')
          Keychain.generate(name)
        } else {
          throw new Error('Identity exits! Pass --ignore or --force')
        }
      } else {
        Keychain.generate(name)
      }
    }
  )
  .command(
    'worker',
    'Run scrapper in worker mode (managed by hypervisor)',
    (yargs) => yargs.option('limit', { type: 'number' }),
    async ({ limit }) => {
      const browser = await getBrowser()
      const manager = new WorkerManager(browser, cliLogger, {
        gateway: process.env.ALTAPI_GATEWAY ?? 'ws://localhost:4010',
        scrapperOptions: { limit },
      })
      manager.start()
    }
  )
  .showHelpOnFail(true)
  .demandCommand()
  .strictCommands()
  .strictOptions()
  .parse()
