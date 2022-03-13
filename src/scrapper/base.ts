import { DateTime } from 'luxon'
import { Logger } from 'pino'
import puppeteer, { Browser, ElementHandle, Page } from 'puppeteer'
import { EventEmitter } from 'events'

export type HandledElement = ElementHandle<Element>

export type ScrapperOptions = {
  /**
   * Data required to access some page (ex. login and password)
   */
  credentials?: Record<string, string>
  skip?: number
  limit?: number
  setDate?: DateTime
  timeout?: number
  repeatFailures?: boolean
}

export async function getBrowser() {
  switch (process.env.NODE_ENV) {
    case 'production':
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
      })
    default:
      return await puppeteer.launch({ headless: false })
  }
}

export enum ScrapperEvent {
  FETCH = 'fetch',
  ERROR = 'error',
}

export abstract class ScrapperBase {
  public abstract readonly isPrivateEndpoint: boolean
  protected activePage?: Page
  private events = new EventEmitter()

  constructor(
    public browser: Browser,
    protected options: ScrapperOptions = {},
    public logger?: Logger
  ) {}

  protected async begin() {
    if (this.isPrivateEndpoint) {
      // Perform checks required privare endpoint
      if (!this.options.credentials) throw new Error('Missing credentials')
    }
    this.activePage = await this.browser.newPage()
  }

  /**
   * This method should login and return list of elements to scrap.
   */
  protected async prepare?(): Promise<unknown[]>

  /**
   * This method reduces size of elements provided by prepare()
   */
  protected async reduce(elements: unknown[]): Promise<unknown[]> {
    const e = elements.slice(
      this.options.skip,
      this.options.limit
        ? this.options.limit + (this.options.skip ?? 0)
        : undefined
    )

    this.logger?.debug('Sliced to %s candidates', e.length)
    return e
  }

  /**
   * This method serialize data into object, classes etc.
   */
  protected abstract scrap(elements?: unknown[]): Promise<unknown>

  /**
   * Called after scrap, reduce RAM usage, etc.
   */
  protected async clean() {
    await this.activePage?.close({ runBeforeUnload: true })
  }

  /**
   * Higher level function, the entrypoint for user
   */
  public async getData(): Promise<unknown> {
    await this.begin()
    let results
    if (this.prepare) results = await this.reduce(await this.prepare())
    const product = await this.scrap(results)
    await this.clean()
    return product
  }

  /**
   * Set listener for events
   */
  public async on(
    event: ScrapperEvent,
    callback: (htmlId: string, context: { body?: string; error?: Error }) => void
  ) {
    this.events.on(event, callback)
  }

  /**
   * Set listener for events
   */
  protected async emit(
    event: ScrapperEvent,
    htmlId: string,
    context: { body?: string; error?: Error }
  ) {
    this.events.emit(event, htmlId, context)
  }
}
