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
import { StealerScrapper } from './scrapper/stealer'
import { DateTime } from 'luxon'
import fs from 'fs/promises'

const cliLogger =
  process.env.NODE_ENV === 'production'
    ? pino({ level: process.env.PINO_LEVEL ?? 'info' })
    : pino({
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:standard' },
        },
        level: process.env.PINO_LEVEL ?? 'debug',
      })

void yargs(hideBin(process.argv))
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
    'Use HTTP forgery to get data much faster (experimental). Try not to go faster than 20 requests per second for longer periods. (maxQueryRate (r/s) = (chunkSize/delayPerChunk) * 1000ms)',
    (yargs) =>
      yargs
        .option('delayPerChunk', {
          description: 'Delay set for each chunk.',
          default: 440,
          type: 'number',
        })
        .option('chunkSize', {
          description: 'Size of chunk of concurrent queries',
          default: 4,
          type: 'number',
        }),
    async ({ gateway, delayPerChunk, chunkSize }) => {
      const manager = new StealerManager(
        cliLogger,
        { gateway },
        { chunkSize, delayPerChunk }
      )
      manager.start()
    }
  )
  .command(
    'dump',
    'Save all data into html files. Use only for debug purposes.',
    (yargs) => yargs,
    async () => {
      let counter = 0
      let startDate = DateTime.local(2022, 9, 5)
      const scraper = new StealerScrapper(
        {
          setDate: startDate,
        },
        cliLogger,
        {
          chunkSize: 12,
          delayPerChunk: 600,
        }
      )

      const minify = (html: string) => {
        return html.trim().replaceAll('\n', '').replaceAll('"', '\\"')
      }

      const saveToDisk = async (content: string) => {
        const date = startDate.toISODate()
        counter += 1

        // create directory if not exists
        await fs.mkdir(`./dump/${date}/${counter}`, { recursive: true })
        // save as html file
        await fs.writeFile(`dump/${date}/${counter}/dump.html`, content)

        // save as minified html file
        await fs.writeFile(
          `dump/${date}/${counter}/dump.min.html`,
          minify(content)
        )
      }

      for (let i = 0; i < 60; i++) {
        const data = await scraper.getData()
        for (const d of data) await saveToDisk(d)
        startDate = startDate.plus({ days: 1 })
        scraper.overwriteConfig({ setDate: startDate })
        cliLogger.info(`Dumped ${data.length} records`)
        counter = 0
      }
    }
  )
  .showHelpOnFail(true)
  .demandCommand()
  .strictCommands()
  .strictOptions()
  .parse()
