import { DateTime } from 'luxon'
import { Logger } from 'pino'
import { WebSocketServer, WebSocket } from 'ws'
import { ScrapperBase, ScrapperEvent, ScrapperOptions } from '../base'

enum BridgeEvents {
  SCRAPPER_CONNECTED = 'scrp-conn',
  TASK_FINISHED = 'scrp-finish',
}

export class SigmaBridge extends ScrapperBase<string> {
  private wsServer: WebSocketServer
  public isPrivateEndpoint = false
  private connectedSigma?: WebSocket
  private elementsScrapped: string[] = []

  constructor(protected options: ScrapperOptions = {}, public logger?: Logger) {
    super()
    this.wsServer = new WebSocketServer({ host: '0.0.0.0', port: 9090 })
    this.setupConnection()
  }

  /**
   * This promise used for awaiting connection from sigma scrapper.
   */
  public isScrapperConnected: Promise<void> = new Promise((resolve) => {
    if (this.connectedSigma) {
      resolve()
      return
    }
    this.logger?.info('Awaiting for sigma scrapper connection')
    this.events.once(BridgeEvents.SCRAPPER_CONNECTED, resolve)
  })

  /**
   * This method should be run onced! Creates event bindings and uploads some metadata to the server.
   */
  private setupConnection() {
    this.wsServer.once('listening', () =>
      this.logger?.info('WS server for bridged comm is ready!')
    )
    this.wsServer.once('connection', (client, message) => {
      this.logger?.info({
        msg: 'Scrapper connected to the bridge!',
      })
      this.connectedSigma = client

      this.events.emit(BridgeEvents.SCRAPPER_CONNECTED)

      this.connectedSigma.on('message', (x) => {
        try {
          const message = x.toString()

          if (message === 'finished') {
            this.events.emit(BridgeEvents.TASK_FINISHED)
            this.logger?.info('Received finish signal')
            return
          }

          const { htmlId, body } = JSON.parse(message) as {
            htmlId: string
            body: string
          }

          this.elementsScrapped.push(body)

          this.logger?.debug('Received %s, size %s', htmlId, body.length)
          this.emit(ScrapperEvent.FETCH, htmlId, { body })
        } catch (err) {
          this.logger?.error(err)
        }
      })

      this.connectedSigma.on('close', () => {
        this.logger?.warn('Connection closed! Exit!')
        this.connectedSigma?.close()
        process.exit()
      })
    })
  }

  protected async scrap(): Promise<string[]> {
    if (!this.connectedSigma) {
      this.logger?.error('No scrapper connected!')
      return []
    }
    this.logger?.info('Forwarding scrap request...')
    this.elementsScrapped = []

    this.connectedSigma.send(
      JSON.stringify({
        scrapUntil: this.options.setDate?.toISO() ?? DateTime.now().toISO(),
      })
    )

    await new Promise<void>((resolve) =>
      this.events.on(BridgeEvents.TASK_FINISHED, resolve)
    )
    return this.elementsScrapped
  }
}
