import { Logger } from 'pino'
import { Browser } from 'puppeteer'
import { PublicScheduleScrapper } from '../scrapper/public'
import { ManagerBase, ManagerConfig } from './base'

/**
 * Class used for managing PJATK public scedule scrapper.
 * @deprecated use stealer instead
 */
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
