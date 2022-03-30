import { Logger } from 'pino'
import { PostDelays, StealerScrapper } from '../scrapper/stealer'
import { ManagerBase, ManagerConfig } from './base'

export class StealerManager extends ManagerBase {
  constructor(
    logger: Logger,
    configuration: ManagerConfig,
    delays?: PostDelays
  ) {
    super(logger, configuration)

    this.scrapper = new StealerScrapper(
      configuration.scrapperOptions,
      logger,
      delays
    )
  }
}
