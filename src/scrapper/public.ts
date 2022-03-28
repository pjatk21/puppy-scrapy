import { DateTime } from 'luxon'
import puppeteer from 'puppeteer'
import { HandledElement } from '..'
import { DateFormats } from '../types'
import { ScrapperEvent } from './base'
import { ScrapperPuppeteer } from './puppeteer'

export class PublicScheduleScrapper extends ScrapperPuppeteer {
  public isPrivateEndpoint = false

  private async updateDate() {
    if (this.options.setDate) {
      // DO NOT UPDATE DATE IF IT'S THE SAME AS ACTUAL DATE!
      if (
        this.options.setDate.toFormat(DateFormats.dateYMD) ===
        DateTime.local().toFormat(DateFormats.dateYMD)
      ) {
        this.logger?.warn(
          "Can't update if taget date is equal to today's date!"
        )
        return
      }

      const datePicker = await this.activePage?.$('#DataPicker_dateInput')
      await datePicker?.click()
      await datePicker?.press('Backspace')
      await datePicker?.type(this.options.setDate.toFormat(DateFormats.dateYMD))
      await datePicker?.press('Enter')
      await this.activePage?.waitForTimeout(2000) // This will cause shit load of problems one day
      this.logger?.debug('Date set to %s!', this.options.setDate.toISO())
    }
  }

  async prepare(): Promise<HandledElement[]> {
    await this.activePage?.goto(
      'https://planzajec.pjwstk.edu.pl/PlanOgolny3.aspx'
    )
    await this.updateDate()
    const entriesAll = (await this.activePage?.$$('tbody td[id*=";"]')) ?? []
    this.logger?.debug('Aquired %s candidates', entriesAll.length)
    const entries: HandledElement[] = []

    let removedReservations = 0

    // Filter non-reservation items
    for (const he of entriesAll) {
      const blockColor = await he
        .getProperty('style')
        .then((props) => props.getProperty('background-color'))
        .then((props) => props.jsonValue())
      if (blockColor !== 'rgb(124, 132, 132)') entries.push(he)
      else removedReservations++
    }

    this.logger?.debug(
      'Removed %s reservations, reduced to %s candidates',
      removedReservations,
      entries.length
    )

    return entries ?? []
  }

  protected async scrap(elements?: HandledElement[]): Promise<string[]> {
    const beginTime = DateTime.local()
    let count = 0
    const entries = []
    for (const he of elements ?? []) {
      // Save htmlId to identify entry
      const htmlId: string = await he
        .getProperty('id')
        .then((props) => props.jsonValue())

      // Hover mouse over box
      await he.click()

      // Wait for tooltip appear
      try {
        await this.activePage?.waitForSelector('#RadToolTipManager1RTMPanel', {
          visible: true,
          timeout: this.options.timeout,
        })
      } catch (error) {
        if (error instanceof puppeteer.errors.TimeoutError)
          this.logger?.warn({ msg: error.message })
        else this.logger?.error({ msg: 'Unknown error', error })
        continue
      }

      // Read content of tooltip
      const tooltipContent = await this.activePage?.$eval(
        '#RadToolTipManager1RTMPanel',
        (elem) => elem.innerHTML
      )

      // Save data
      this.emit(ScrapperEvent.FETCH, htmlId, { body: tooltipContent })
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      entries.push(tooltipContent!)

      // Clear previous tooltip
      await this.activePage?.keyboard.press('Escape')

      // Log remaining time
      const avgTime = DateTime.local().diff(beginTime).toMillis() / ++count
      const timeLeft = avgTime * ((elements?.length ?? 0) - count)
      this.logger?.debug(
        'Avg. scrap time: %sms, expected finish in %ss at %s',
        avgTime.toFixed(2),
        Math.ceil(timeLeft / 1000),
        DateTime.local().plus({
          milliseconds: timeLeft,
        })
      )
    }

    this.logger?.debug(
      'Fetched %s in %ss',
      elements?.length,
      (DateTime.local().diff(beginTime).toMillis() / 1000).toFixed(2)
    )

    return entries
  }

  // type shit
  public async getData(): Promise<string[]> {
    return super.getData() as Promise<string[]>
  }
}
