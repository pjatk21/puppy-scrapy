import { Logger } from 'pino'
import { SigmaBridge } from '../scrapper/sigma/bridge'
import { ManagerBase, ManagerConfig } from './base'

/**
 * Manager for bridge between altapi and sigma scrapper.
 */
export class BridgeManager extends ManagerBase {
  constructor(logger: Logger, configuration: ManagerConfig) {
    super(logger, configuration)

    this.scrapper = new SigmaBridge(configuration.scraperOptions, logger)
    this.isReady = (this.scrapper as SigmaBridge).isScrapperConnected // ready if scrapper is connected
  }
}
