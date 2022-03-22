import { DateTime } from 'luxon'
import { Logger } from 'pino'
import { WebSocketServer, WebSocket } from 'ws'
import { HypervisorScrapArgs } from '../../altapi/hypervisor-types'
import { ScrapperBase, ScrapperOptions } from '../base'

export class SigmaBridge extends ScrapperBase {
  private wsServer: WebSocketServer
  public isPrivateEndpoint = false
  private connectedSigma?: WebSocket

  constructor(protected options: ScrapperOptions = {}, public logger?: Logger) {
    super()
    this.wsServer = new WebSocketServer({ port: 9090 })
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
      this.logger?.info(message)
      this.connectedSigma = client

      this.events.emit('scrp-conn')
      client.on('message', (x) => this.logger?.warn('NOT IMPLEMNTED DATA', x))
    })
  }

  protected async scrap(): Promise<unknown> {
    this.connectedSigma?.send({
      scrapUntil: DateTime.now().plus({ days: 3 }).toISO(),
    } as HypervisorScrapArgs)
    this.logger?.warn('Simulating work...')
    // setTimeout(() => this.events.emit('FINISHED'), 5000) // replace this line with REAL logic
    await new Promise<void>((resolve) =>
      this.connectedSigma?.on('message', (message) => {
        if (message.toString() === 'finished') resolve()
      })
    )
    return
  }
}
