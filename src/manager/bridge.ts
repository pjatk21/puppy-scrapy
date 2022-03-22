import { Logger } from 'pino'
import { SigmaBridge } from '../scrapper/sigma/bridge'
import { ManagerBase, ManagerConfig } from './base'

export class BridgeManager extends ManagerBase {
  constructor(logger: Logger, configuration: ManagerConfig) {
    super(logger, configuration)

    this.scrapper = new SigmaBridge(configuration.scrapperOptions, logger)
    this.isReady = (this.scrapper as SigmaBridge).scrapperConnected
  }
}
