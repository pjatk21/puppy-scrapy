import { Logger } from 'pino'
import { ThrottlingOptions, StealerScrapper } from '../scrapper/stealer'
import { ManagerBase, ManagerConfig } from './base'

export class StealerManager extends ManagerBase {
  constructor(
    logger: Logger,
    configuration: ManagerConfig,
    delays?: ThrottlingOptions
  ) {
    super(logger, configuration)

    this.scrapper = new StealerScrapper(
      configuration.scrapperOptions,
      logger,
      delays
    )
  }
}
