import { HypervisorScrapperCommands } from './hypevisor-enums'

export type HypervisorScrapArgs = {
  scrapStart?: string
  scrapUntil: string
  limit?: number
  skip?: number
}

export type HypervisorCommandExec = {
  command: HypervisorScrapperCommands
  context: HypervisorScrapArgs | null
}
