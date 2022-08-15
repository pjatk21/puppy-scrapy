import { Logger } from 'pino'
import { Page, Browser } from 'puppeteer'
import { ScrapperBase, ScrapperOptions } from './base'
import puppeteer from 'puppeteer'

export async function getBrowser() {
  switch (process.env.NODE_ENV) {
    case 'production':
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
      })
    default:
      return await puppeteer.launch({ headless: true })
  }
}

export abstract class ScrapperPuppeteer<T> extends ScrapperBase<T> {
  public abstract readonly isPrivateEndpoint: boolean
  protected activePage?: Page

  constructor(
    public browser: Browser,
    protected options: ScrapperOptions = {},
    public logger?: Logger
  ) {
    super(options, logger)
  }

  protected async begin() {
    await super.begin()
    this.activePage = await this.browser.newPage()
  }

  /**
   * Called after scrap, reduce RAM usage, etc.
   */
  protected async clean() {
    await this.activePage?.close({ runBeforeUnload: true })
  }
}
