import { Logger } from "pino";
import { Page, Browser, EventEmitter } from "puppeteer";
import { ScrapperBase, ScrapperEvent, ScrapperOptions } from "./base";

export abstract class ScrapperPuppeteer extends ScrapperBase {
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
    super.begin()
    this.activePage = await this.browser.newPage()
  }

  /**
   * Called after scrap, reduce RAM usage, etc.
   */
  protected async clean() {
    await this.activePage?.close({ runBeforeUnload: true })
  }
}
