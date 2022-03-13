import { HypervisorScrapperCommands } from './hypevisor-enums'

export type HypervisorScrapArgs = {
  /**
   * An ISO 8061 date string
   */
  scrapUntil: string
  limit?: number
  skip?: number
}

export type HypervisorCommandExec = {
  command: HypervisorScrapperCommands
  context: HypervisorScrapArgs | null
}
