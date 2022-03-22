import { DateTime } from 'luxon'
import { Logger } from 'pino'
import { WebSocketServer, WebSocket } from 'ws'
import { HypervisorScrapArgs } from '../../altapi/hypervisor-types'
import { ScrapperBase, ScrapperEvent, ScrapperOptions } from '../base'

export class SigmaBridge extends ScrapperBase {
  private wsServer: WebSocketServer
  public isPrivateEndpoint = false
  private connectedSigma?: WebSocket

  constructor(protected options: ScrapperOptions = {}, public logger?: Logger) {
    super()
    this.wsServer = new WebSocketServer({ host: '0.0.0.0', port: 9090 })
    this.setupConnection()
  }

  public scrapperConnected: Promise<void> = new Promise((resolve) => {
    this.logger?.info('Awaiting for sigma scrapper connection')
    this.events.once('scrp-conn', resolve)
  })

  private setupConnection() {
    this.wsServer.once('listening', () =>
      this.logger?.info('WS server for bridged comm is ready!')
    )
    this.wsServer.once('connection', (client, message) => {
      this.logger?.info({
        msg: 'Scrapper connected to the bridge!',
      })
      this.connectedSigma = client

      this.events.emit('scrp-conn')

      this.connectedSigma.on('message', (x) => {
        try {
          const message = x.toString()

          if (message === 'finished') {
            this.events.emit('scrp-finish')
            this.logger?.info('Received finish signal')
            return
          }

          const { htmlId, body } = JSON.parse(message) as {
            htmlId: string
            body: string
          }

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

  protected async scrap(): Promise<unknown> {
    this.logger?.info('Forwarding scrap request...')

    this.connectedSigma?.send(
      JSON.stringify({
        scrapUntil: this.options.setDate?.toISO() ?? DateTime.now().toISO(),
      } as HypervisorScrapArgs)
    )

    await new Promise<void>((resolve) => this.events.on('scrp-finish', resolve))
    return
  }
}
