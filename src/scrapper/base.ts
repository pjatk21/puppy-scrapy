import { DateTime } from 'luxon'
import { Logger } from 'pino'
import puppeteer, { Browser, ElementHandle, Page } from 'puppeteer'

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

export abstract class ScrapperBase {
  public abstract readonly isPrivateEndpoint: boolean
  protected activePage?: Page

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
  protected async prepare?(): Promise<HandledElement[]>

  /**
   * This method reduces size of elements provided by prepare()
   */
  protected async reduce(
    elements: HandledElement[]
  ): Promise<HandledElement[]> {
    return elements.slice(
      this.options.skip,
      this.options.limit
        ? this.options.limit + (this.options.skip ?? 0)
        : undefined
    )
  }

  /**
   * This method serialize data into object, classes etc.
   */
  protected abstract scrap(elements?: HandledElement[]): Promise<unknown>

  /**
   * Called after scrap, reduce RAM usage, etc.
   */
  protected async clean() {
    await this.activePage?.close({ runBeforeUnload: true })
  }

  /**
   * Higher level function, the entrypoint for user
   */
  async getData() {
    await this.begin()
    let results
    if (this.prepare) results = await this.reduce(await this.prepare())
    const product = await this.scrap(results)
    await this.clean()
    return product
  }
}
