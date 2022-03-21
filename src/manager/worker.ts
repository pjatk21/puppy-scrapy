import { DateTime } from 'luxon'
import { Logger } from 'pino'
import { Browser } from 'puppeteer'
import { io, Manager } from 'socket.io-client'
import {
  HypervisorEvents,
  HypervisorScrapperCommands,
  HypervisorScrapperState as HSState,
} from '../altapi/hypevisor-enums'
import { Keychain } from '../keychain'
import { ScrapperEvent, ScrapperOptions } from '../scrapper/base'
import { PublicScheduleScrapper } from '../scrapper/public'
import { HypervisorScrapArgs } from '../altapi/hypervisor-types'
import { ManagerBase, ManagerConfig } from './base'

export class WorkerManager extends ManagerBase {
  protected scrapper: PublicScheduleScrapper

  constructor(
    private browser: Browser,
    logger: Logger,
    configuration: ManagerConfig
  ) {
    super(logger, configuration)

    // create scrapper instance
    this.scrapper = new PublicScheduleScrapper(
      this.browser,
      configuration.scrapperOptions,
      logger
    )
  }
}
