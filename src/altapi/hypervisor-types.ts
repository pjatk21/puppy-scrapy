import { HypervisorScrapperCommands } from './hypevisor-enums'

export type HypervisorScrapArgs =
  | { daysAhead?: number }
  | { numberOfEntriesAhead?: number }
  | { scrapUntil?: Date }

export type HypervisorCommandExec = {
  command: HypervisorScrapperCommands
  context: HypervisorScrapArgs | null
}
