import { DateTime } from 'luxon'
import { Logger } from 'pino'
import { ElementHandle } from 'puppeteer'
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

export enum ScrapperEvent {
  FETCH = 'fetch',
  ERROR = 'error',
}

export abstract class ScrapperBase<R = unknown> {
  public abstract readonly isPrivateEndpoint: boolean
  protected events = new EventEmitter()

  constructor(
    protected options: ScrapperOptions = {},
    public logger?: Logger
  ) {}

  protected async begin() {
    if (this.isPrivateEndpoint) {
      // Perform checks required privare endpoint
      if (!this.options.credentials) throw new Error('Missing credentials')
    }
  }

  public overwriteConfig(newConfig: Partial<ScrapperOptions>) {
    this.logger?.warn({
      msg: 'Overwriting current configutration!',
      ...newConfig,
    })
    this.options = { ...this.options, ...newConfig }
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
  protected abstract scrap(elements?: unknown[]): Promise<R[]>

  /**
   * Called after scrap, reduce RAM usage, etc.
   */
  protected clean?(): Promise<void>

  /**
   * Higher level function, the entrypoint for user
   */
  public async getData(): Promise<R[]> {
    await this.begin()
    let results
    if (this.prepare) results = await this.reduce(await this.prepare())
    const product = await this.scrap(results)
    if (this.clean) await this.clean()
    return product
  }

  /**
   * Set listener for events
   */
  public async on(
    event: ScrapperEvent,
    callback: (
      htmlId: string,
      context: { body?: string; error?: Error }
    ) => void
  ) {
    this.events.on(event, callback)
  }

  /**
   * Set listener for events
   */
  protected emit(
    event: ScrapperEvent,
    htmlId: string,
    context: { body?: string; error?: Error }
  ) {
    this.events.emit(event, htmlId, context)
  }
}
