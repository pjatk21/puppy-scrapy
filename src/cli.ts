#!/usr/bin/env node --experimental-specifier-resolution=node
import pino from 'pino'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import 'dotenv/config'
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
      'URL for API websocket gateway, can be set by env PUPPY_GATEWAY.',
    default: process.env.PUPPY_GATEWAY ?? 'ws://localhost:3000/graphql',
  })
  .option('token', {
    type: 'string',
    default: process.env.SCRAPER_TOKEN,
  })
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
    async ({ gateway, delayPerChunk, chunkSize, token }) => {
      if (!token) throw new Error('Token is required!')

      const manager = new StealerManager(
        cliLogger,
        { gateway, token },
        { chunkSize, delayPerChunk }
      )
      await manager.start()
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
