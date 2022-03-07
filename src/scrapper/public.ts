import { DateTime } from 'luxon'
import { HandledElement } from '..'
import { DateFormats, ScheduleEntry } from '../types'
import { ScrapperBase } from './base'

export class PublicScheduleScrapper extends ScrapperBase {
  public isPrivateEndpoint = false

  private async updateDate() {
    if (this.options.setDate) {
      // DO NOT UPDATE DATE IF IT'S THE SAME AS ACTUAL DATE!
      if (
        this.options.setDate.toFormat(DateFormats.dateYMD) === DateTime.local().toFormat(DateFormats.dateYMD)
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
      await this.activePage?.waitForTimeout(2000)
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

    // Filter non-reservation items
    for (const he of entriesAll) {
      const blockColor = await he
        .getProperty('style')
        .then((props) => props.getProperty('background-color'))
        .then((props) => props.jsonValue())
      if (blockColor !== 'rgb(124, 132, 132)') entries.push(he)
      else this.logger?.info('Removed reservation')
    }

    this.logger?.debug('Reduced to %s candidates', entries.length)

    return entries ?? []
  }

  private parseTooltipContent(rawContent: string) {
    return rawContent
      .replace(/(^\s+$| {2,})/gm, '')
      .replace(/\n+/gm, '\n')
      .trim()
      .split('\n')
  }

  private parsedLinesIntoObject(lines: string[]): ScheduleEntry {
    const nameMapping = new Map()
      .set('Data zajęć:', 'stringDate')
      .set('Godz. rozpoczęcia:', 'stringTimeBegin')
      .set('Godz. zakończenia:', 'stringTimeEnd')
      .set('Typ zajęć:', 'type')
      .set('Kody przedmiotów:', 'code')
      .set('Nazwy przedmiotów:', 'name')
      .set('Sala:', 'room')
      .set('Dydaktycy:', 'tutor')
      .set('Budynek:', 'building')
      .set('Grupy:', 'groups')

    const o = new Object() as Record<string, string>

    /**
     * WARNING, DYNAMIC HACKERY AHEAD!
     * From: present me
     * To: future me
     * this piece of code matches even lines (heads) with non-even lines (values)
     * if head is not present in mapping, it will be ommited
     * it's important to add ":" to any new head mapping
     */
    for (let i = 0; i < lines.length; i += 2) {
      if (nameMapping.has(lines[i])) {
        o[nameMapping.get(lines[i])] = lines[i + 1]
      }
    }

    /**
     * WARNING, TIMEZONES AHEAD!
     * DO NOT REMOVE OR CHANGE THEM
     */
    return {
      begin: DateTime.fromFormat(
        `${o.stringDate} ${o.stringTimeBegin}`,
        DateFormats.dateDMYHMS
      ).setZone('Europe/Warsaw'),
      end: DateTime.fromFormat(
        `${o.stringDate} ${o.stringTimeEnd}`,
        DateFormats.dateDMYHMS
      ).setZone('Europe/Warsaw'),
      raw: {
        groups: o.groups,
        date: o.stringDate,
        begin: o.stringTimeBegin,
        end: o.stringTimeEnd,
      },
      name: o.name,
      code: o.code,
      tutor: o.tutor !== '---' ? o.tutor : null,
      building: o.building,
      room: o.room,
      type: o.type,
      groups: o.groups.split(', '),
    }
  }

  protected async scrap(elements?: HandledElement[]): Promise<ScheduleEntry[]> {
    const beginTime = DateTime.local()
    let count = 0
    const entries = []
    for (const he of elements ?? []) {
      await he.click()
      await this.activePage?.waitForSelector('#RadToolTipManager1RTMPanel', {
        visible: true,
        timeout: this.options.timeout ?? 5000,
      })
      const tooltipContent = await this.activePage?.$eval(
        '#RadToolTipManager1RTMPanel',
        (elem) => elem.textContent
      )
      entries.push(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.parsedLinesIntoObject(this.parseTooltipContent(tooltipContent!))
      )

      const avgTime = DateTime.local().diff(beginTime).toMillis() / ++count
      const timeLeft = avgTime * (elements?.length ?? 0 - count)
      this.logger?.debug(
        'Avg. scrap time: %sms, expected finish in %s at %s',
        avgTime.toFixed(2),
        timeLeft.toFixed(2),
        DateTime.local().plus({
          milliseconds: timeLeft,
        })
      )
    }
    this.logger?.debug(
      'Fetched',
      elements?.length,
      'in',
      DateTime.local().diff(beginTime).toHuman()
    )
    return entries
  }
}
