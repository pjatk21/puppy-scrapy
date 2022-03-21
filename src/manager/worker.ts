import { Logger } from 'pino'
import { Browser } from 'puppeteer'
import { PublicScheduleScrapper } from '../scrapper/public'
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
