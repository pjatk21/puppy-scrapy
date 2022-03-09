import { Logger } from 'pino'
import { Browser } from 'puppeteer'
import { io } from 'socket.io-client'
import { ScrapperEvent } from './scrapper/base'
import { PublicScheduleScrapper } from './scrapper/public'

export type ManagerConfig = {
  gateway: string
}

export class WorkerManager {
  private scrapper: PublicScheduleScrapper
  readonly socket: ReturnType<typeof io>
  private pendingPromise?: Promise<unknown>

  constructor(
    private browser: Browser,
    protected readonly logger: Logger,
    configuration: ManagerConfig
  ) {
    this.socket = io(configuration.gateway, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    })
    this.scrapper = new PublicScheduleScrapper(browser, undefined, logger)
    this.scrapper.on(ScrapperEvent.FETCH, (htmlId: string, context: any) =>
      this.transporter(htmlId, context)
    )
  }

  private transporter(
    htmlId: string,
    context: { body?: string; error?: Error }
  ) {
    const { body, error } = context
    if (error) {
      this.logger.error(error)
      this.socket.emit('incident', {
        htmlId,
        title: error.name,
        description: error.message,
      })
    }
    // this.logger.info({htmlId, body})
    if (body) this.socket.emit('upload', { htmlId, body })
  }

  private handleCommand(ev: unknown) {
    this.logger.debug(ev)
    this.pendingPromise = this.scrapper.getData()
  }

  private register() {
    this.logger.info(
      'Connected to gateway! ID: "%s", transport: %s',
      this.socket.id,
      this.socket.io.engine.transport.name
    )
    this.socket.on('cmd', (ev) => this.handleCommand(ev))
  }

  start() {
    this.logger.info('Starting manager...')
    this.socket.connect()
    this.socket.once('connect', () => this.register())
    this.socket.once('disconnect', (reason) => {
      this.logger.warn('Disconnected (%s)!', reason.toString())
      process.exit()
    })
  }
}
