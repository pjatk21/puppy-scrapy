import { DateTime } from 'luxon'
import { Logger } from 'pino'
import { io } from 'socket.io-client'
import {
  HypervisorEvents,
  HypervisorScrapperCommands,
  HypervisorScrapperState as HSState,
} from '../altapi/hypevisor-enums'
import { Keychain } from '../keychain'
import { ScrapperBase, ScrapperEvent, ScrapperOptions } from '../scrapper/base'
import { HypervisorScrapArgs } from '../altapi/hypervisor-types'

export type ManagerConfig = {
  gateway: string
  scrapperOptions?: ScrapperOptions
}

export abstract class ManagerBase {
  protected scrapper?: ScrapperBase
  readonly socket: ReturnType<typeof io>
  protected pendingPromise: Promise<unknown> | null = null

  constructor(protected readonly logger: Logger, configuration: ManagerConfig) {
    // setup socket
    this.socket = io(configuration.gateway, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    })
  }

  public isReady: Promise<void> = new Promise((resolve) => resolve())

  /**
   * Sends body or error to the server, the preffered way to upload data to the server
   * @param htmlId id property from html, used as task identifier
   * @param context payload which will be sent to the server
   */
  protected transporter(
    htmlId: string,
    context: { body?: string; error?: Error }
  ) {
    const { body, error } = context
    if (error) {
      this.logger.error(error)
    }
    // this.logger.info({htmlId, body})
    if (body) this.socket.emit(HypervisorEvents.SCHEDULE, { htmlId, body })
  }

  /**
   * Reports state to the hypervisor
   * @param state
   */
  protected updateState(state: HSState) {
    this.socket.emit(HypervisorEvents.STATE, state)
    this.logger.info('Updated state to %s', state)
  }

  /**
   * Command dispatcher
   * @param ev command issued by hypervisor
   */
  protected handleCommand(ev: HypervisorScrapperCommands, arg: unknown) {
    this.logger.info({ ev, arg })
    this.updateState(HSState.WORKING)

    if (this.pendingPromise !== null) {
      this.logger.warn("Can't run command, promise pending!")
      return
    }

    switch (ev) {
      case HypervisorScrapperCommands.SCRAP:
        this.pendingPromise = this.manageScrap(arg as HypervisorScrapArgs)
          .then(() => (this.pendingPromise = null))
          .then(() => this.updateState(HSState.READY))
        break
      case HypervisorScrapperCommands.DISCONNECT:
        this.socket.disconnect()
        break
    }
  }

  protected async manageScrap(scrapArgs: HypervisorScrapArgs) {
    if (!this.scrapper) throw new Error("Scrapper hasn't been initalized!")
    const scrapUntil = DateTime.fromISO(scrapArgs.scrapUntil).setZone()

    this.logger.info('Scrapping until %s...', scrapArgs.scrapUntil)
    let activeDate = scrapArgs.scrapStart
      ? DateTime.fromISO(scrapArgs.scrapStart)
      : DateTime.now()

    while (activeDate < scrapUntil) {
      this.scrapper.overwriteConfig({
        setDate: activeDate,
        limit: scrapArgs.limit,
        skip: scrapArgs.skip,
      })
      await this.scrapper.getData()

      activeDate = activeDate.plus({ day: 1 })
    }
  }

  /**
   * This method registers scrapper in the hypervisor.
   */
  protected register() {
    this.logger.info(
      'Connected to gateway! ID: "%s", transport: %s',
      this.socket.id,
      this.socket.io.engine.transport.name
    )

    this.socket.emit(HypervisorEvents.PASSPORT, new Keychain().read())

    this.socket.once(HypervisorEvents.VISA, () => {
      this.logger.info('Visa received!')

      // Setup events
      this.initTransportEvent()
      this.socket.on(HypervisorEvents.COMMAND, (ev, arg) =>
        this.handleCommand(ev, arg)
      )

      // Wait and mark it as ready
      this.isReady.then(() => this.updateState(HSState.READY))
    })
  }

  /**
   * Set upload event (executed after each schedule entry scrapped)
   */
  protected initTransportEvent() {
    this.scrapper?.on(ScrapperEvent.FETCH, (htmlId: string, context: any) =>
      this.transporter(htmlId, context)
    )
  }

  /**
   * Entrypoint of the scrapper
   */
  start() {
    this.logger.info('Starting manager...')
    this.logger.debug({
      msg: 'Runtime',
      scrapper: this.scrapper?.constructor.name,
      node: process.version,
      version: process.env.npm_package_version,
    })
    this.socket.connect()
    this.socket.once('connect', () => this.register())

    // code related to the gentle connection drop
    this.socket.once('disconnect', (reason) => {
      this.logger.warn('Disconnected from hypervisor (%s)!', reason.toString())
      process.exit()
    })
  }
}
