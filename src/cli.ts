#!/usr/bin/env node --experimental-specifier-resolution=node
import pino from 'pino'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { getBrowser } from '.'
import 'dotenv/config'
import { existsSync } from 'fs'
import { WorkerManager } from './manager/worker'
import { Keychain } from './keychain'
import { BridgeManager } from './manager/bridge'
import { StealerManager } from './manager/stealer'

const cliLogger =
  process.env.NODE_ENV === 'production'
    ? pino({ level: process.env.PINO_LEVEL ?? 'info' })
    : pino({
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:standard' },
        },
        level: 'debug',
      })

yargs(hideBin(process.argv))
  .option('gateway', {
    description:
      'URL for API websocket gateway, can be set by env ALTAPI_GATEWAY.',
    default: process.env.ALTAPI_GATEWAY ?? 'ws://localhost:4010',
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
        .option('bridge', { description: 'Changes prefix".', type: 'boolean' })
        .option('name', { description: 'Name of scrapper.', type: 'string' }),
    ({ ignore, force, name, bridge }) => {
      if (ignore && force) throw new Error("You can't pass both flags!")

      if (existsSync('identity.json')) {
        if (ignore) console.debug('Identity already exitst! Ignoring...')
        else if (force) {
          console.debug('Overwritting identity...')
          Keychain.generate(name, bridge)
        } else {
          throw new Error('Identity exits! Pass --ignore or --force')
        }
      } else {
        Keychain.generate(name)
      }
    }
  )
  .command(
    'bridge',
    'Run sigma scrapper with alt scrap translation layer',
    (yargs) => yargs,
    async ({ gateway }) => {
      const manager = new BridgeManager(cliLogger, { gateway })
      manager.start()
    }
  )
  .command(
    'worker',
    'Run scrapper in worker mode (managed by hypervisor)',
    (yargs) => yargs,
    async ({ gateway }) => {
      const browser = await getBrowser()
      const manager = new WorkerManager(browser, cliLogger, {
        gateway,
      })
      manager.start()
    }
  )
  .command(
    'stealer',
    'Use HTTP forgery to get data much faster (experimental)',
    (yargs) =>
      yargs.option('delayPerEntry', {
        description: 'Delay set for each query.',
        default: 40,
        type: 'number',
      }),
    async ({ gateway, delayPerEntry }) => {
      const manager = new StealerManager(
        cliLogger,
        { gateway },
        { ratio: delayPerEntry }
      )
      manager.start()
    }
  )
  .showHelpOnFail(true)
  .demandCommand()
  .strictCommands()
  .strictOptions()
  .parse()
