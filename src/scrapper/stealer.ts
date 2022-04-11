import got from 'got'
import type { Response } from 'got'
import { JSDOM } from 'jsdom'
import { ScrapperBase, ScrapperEvent, ScrapperOptions } from './base'
import assert from 'assert'
import { DateTime, Duration } from 'luxon'
import { Logger } from 'pino'

type BaseStates = {
  viewState: string
  eventValidation: string
  viewStateGenerator: string
}

export type PostDelays = {
  ratio: number
}

export class StealerScrapper extends ScrapperBase<string> {
  constructor(
    options?: ScrapperOptions,
    logger?: Logger,
    private delays?: PostDelays
  ) {
    super(options, logger)
    this.timestamps.scrapperInital = DateTime.now()
  }

  public isPrivateEndpoint = false

  private readonly timestamps: Partial<{
    scrapperInital: DateTime
    sourceScrap: DateTime
    targetScrap: DateTime
  }> = {}

  private client = got.extend({
    headers: {
      'X-MicrosoftAjax': 'Delta=true',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
  })

  private baseStates: Partial<BaseStates> = {}

  private get baseStatesAsFormParts(): Record<string, string> {
    const { viewState, eventValidation, viewStateGenerator } = this.baseStates
    assert(
      viewState && eventValidation && viewStateGenerator,
      'Missing states!'
    )
    return {
      __VIEWSTATE: viewState,
      __EVENTVALIDATION: eventValidation,
      __VIEWSTATEGENERATOR: viewStateGenerator,
    }
  }

  /**
   * Update ASP.NET states from GET responses
   * @param response response from webservice
   */
  private updateBaseStates(response: Response<string>) {
    assert(response.statusCode === 200, 'Invalid status code!')
    const frag = JSDOM.fragment(response.body)
    this.baseStates.viewState = (
      frag.querySelector('input[name="__VIEWSTATE"]') as HTMLInputElement
    ).value
    this.baseStates.eventValidation = (
      frag.querySelector('input[name="__EVENTVALIDATION"]') as HTMLInputElement
    ).value
    this.baseStates.viewStateGenerator = (
      frag.querySelector(
        'input[name="__VIEWSTATEGENERATOR"]'
      ) as HTMLInputElement
    ).value
  }

  /**
   * Update ASP.NET states from POST (delta=true) responses
   * @param response response from webservice
   */
  private updateBaseStatesFromDelta(response: Response<string>) {
    assert(response.statusCode === 200, 'Invalid status code!')
    const shards = response.body.split('|')
    this.baseStates.viewState = shards[shards.indexOf('__VIEWSTATE') + 1]
    this.baseStates.eventValidation =
      shards[shards.indexOf('__EVENTVALIDATION') + 1]
    this.baseStates.viewStateGenerator =
      shards[shards.indexOf('__VIEWSTATEGENERATOR') + 1]
  }

  private htmlFromResponse(response: Response<string>) {
    return response.body.split('|')[7]
  }

  private async updateDate(target_date: string) {
    const newDateSetResponse = await this.client.post(
      'https://planzajec.pjwstk.edu.pl/PlanOgolny3.aspx',
      {
        form: {
          RadScriptManager1: 'RadAjaxPanel1Panel|DataPicker',
          __EVENTTARGET: 'DataPicker',
          __EVENTARGUMENT: '',
          ...this.baseStatesAsFormParts,
          DataPicker: target_date,
          DataPicker$dateInput: target_date,
          DataPicker_ClientState: '',
          DataPicker_dateInput_ClientState:
            '{"enabled":true,"emptyMessage":"","validationText":"{{DATE}}-00-00-00","valueAsString":"{{DATE}}-00-00-00","minDateStr":"1980-01-01-00-00-00","maxDateStr":"2099-12-31-00-00-00","lastSetTextBoxValue":"{{DATE}}"}'.replaceAll(
              '{{DATE}}',
              target_date
            ),
          __ASYNCPOST: 'true',
          RadAJAXControlID: 'RadAjaxPanel1',
        },
      }
    )
    this.updateBaseStatesFromDelta(newDateSetResponse)
    return newDateSetResponse
  }

  private async getDataOfId(target_id: string) {
    const detailsResponse = await this.client.post(
      'https://planzajec.pjwstk.edu.pl/PlanOgolny3.aspx',
      {
        form: {
          RadScriptManager1:
            'RadToolTipManager1RTMPanel|RadToolTipManager1RTMPanel',
          __EVENTTARGET: 'RadToolTipManager1RTMPanel',
          __EVENTARGUMENT: '',
          ...this.baseStatesAsFormParts,
          RadToolTipManager1_ClientState:
            '{"AjaxTargetControl":"{html_id}","Value":"{html_id}"}'.replaceAll(
              '{html_id}',
              target_id
            ),
        },
      }
    )
    this.updateBaseStatesFromDelta(detailsResponse)
    this.logger?.debug(
      'Data for id "%s" fetched in %sms!',
      target_id,
      detailsResponse.timings.end! - detailsResponse.timings.start
    )
    return detailsResponse
  }

  async prepare() {
    this.timestamps.sourceScrap = DateTime.now()
    const initialResponse = await this.client.get(
      'https://planzajec.pjwstk.edu.pl/PlanOgolny3.aspx'
    )
    this.updateBaseStates(initialResponse)
    const shouldUpdateDate =
      DateTime.now().toISODate() !== this.options.setDate?.toISODate()
    this.logger?.info({ shouldUpdateDate })
    const { body } = shouldUpdateDate
      ? await this.updateDate(this.options.setDate!.toISODate())
      : initialResponse
    const allIds = new Set<string>(body.match(/\d+?;[z]/g) ?? [])

    return Array.from(allIds)
  }

  protected async scrap(elements: string[]): Promise<string[]> {
    this.timestamps.targetScrap = DateTime.now()
    const promises = elements.map((elem) =>
      this.getDataOfId(elem)
        .then((r) => {
          const htmlString = this.htmlFromResponse(r)
          this.emit(ScrapperEvent.FETCH, elem, {
            body: htmlString,
          })
          return htmlString
        })
        .catch(({ type, message }) =>
          this.logger?.error({ errType: type, message })
        )
    )
    const responses = await Promise.all(promises)
    this.logTimeStats(responses.length)

    if (this.delays) {
      const delay =
        (Math.random() + 0.5) * this.delays.ratio * (responses.length * 22)
      this.logger?.info(
        'Delays configured, waiting %s.',
        Duration.fromMillis(delay)
          .shiftTo('minutes', 'seconds', 'milliseconds')
          .toHuman()
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    return responses.filter((x) => typeof x === 'string') as string[]
  }

  private logTimeStats(responsesCount: number) {
    const now = DateTime.now()

    const { scrapperInital, sourceScrap, targetScrap } = this.timestamps
    if (!(scrapperInital && sourceScrap && targetScrap)) {
      this.logger?.error('Missing timestamps! Skipping stats generation!')
      return
    }

    this.logger?.info(
      {
        initalizing: sourceScrap
          .diff(scrapperInital)
          .shiftTo('seconds', 'milliseconds')
          .toHuman(),
        prepare: targetScrap
          .diff(sourceScrap)
          .shiftTo('seconds', 'milliseconds')
          .toHuman(),
        main: now
          .diff(targetScrap)
          .shiftTo('seconds', 'milliseconds')
          .toHuman(),
        overall: now
          .diff(scrapperInital)
          .shiftTo('seconds', 'milliseconds')
          .toHuman(),
        requestRate:
          (responsesCount / now.diff(targetScrap).as('seconds')).toFixed(3) +
          'r/s',
        scrapSize: responsesCount,
      },
      'Timings for scrap of date %s',
      this.options.setDate?.toISODate()
    )
  }
}
