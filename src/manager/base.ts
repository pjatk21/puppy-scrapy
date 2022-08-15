import { DateTime } from 'luxon'
import { Logger } from 'pino'
import {
  ApolloClient,
  ApolloError,
  InMemoryCache,
  NormalizedCacheObject,
} from '@apollo/client/core'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { ScrapperBase, ScrapperEvent, ScrapperOptions } from '../scrapper/base'
import {
  DispositionsSubscription,
  DispositionsSubscriptionVariables,
  ProcessFragmentMutation,
  ProcessFragmentMutationVariables,
  ScrapTask,
} from '@auto/graphql'
import { processFragmentMutation, tasksSubscription } from './queries'
import WebSocket from 'ws'

export type ManagerConfig = {
  gateway: string
  scrapperOptions?: ScrapperOptions
}

/**
 * The base class for implementing manager for any scrapper.
 */
export abstract class ManagerBase {
  /**
   * Scrapper to manage.
   */
  protected scrapper?: ScrapperBase

  readonly client: ApolloClient<NormalizedCacheObject>

  /**
   * Used for indicate if task is running.
   */
  protected pendingPromise: Promise<unknown> | null = null

  constructor(protected readonly logger: Logger, configuration: ManagerConfig) {
    const wsLink = new GraphQLWsLink(
      createClient({
        url: configuration.gateway,
        webSocketImpl: WebSocket,
      })
    )

    this.client = new ApolloClient({
      cache: new InMemoryCache(),
      link: wsLink,
    })
  }

  /**
   * A promise which will be awaited to change state from start to ready.
   */
  public isReady: Promise<void> = new Promise((resolve) => resolve())

  /**
   * Sends body or error to the server, the preffered way to upload data to the server.
   * @param htmlId id property from html, used as task identifier
   * @param context payload which will be sent to the server
   */
  protected async transporter(
    htmlId: string,
    context: { body?: string; error?: Error }
  ) {
    const { body, error } = context
    if (error) {
      this.logger.error(error)
    }
    // this.logger.info({htmlId, body})
    if (!body) return
    await this.client
      .mutate<ProcessFragmentMutation, ProcessFragmentMutationVariables>({
        mutation: processFragmentMutation,
        variables: {
          html: body,
        },
      })
      .catch((e) => {
        if (!(e instanceof ApolloError)) this.logger.error(e)
      })
    //if (body) this.socket.emit(HypervisorEvents.SCHEDULE, { htmlId, body })
  }

  /**
   * Reports state to the hypervisor.
   * @param state
   */
  protected updateState(state: string) {
    // console.log(state)
  }

  /**
   * Main method for managing scrap process.
   * @param task arguments received from the server
   */
  protected async manageScrap(task: ScrapTask) {
    if (!this.scrapper) throw new Error("Scrapper hasn't been initalized!")
    const scrapUntil = DateTime.fromISO(task.until).setZone()

    this.logger.info('Scrapping until %s...', task.until)
    let activeDate = task.since ? DateTime.fromISO(task.since) : DateTime.now()

    while (activeDate < scrapUntil) {
      this.scrapper.overwriteConfig({
        setDate: activeDate,
        // limit: task.limit,
        // skip: task.skip,
      })
      await this.scrapper.getData()

      activeDate = activeDate.plus({ day: 1 })
    }
  }

  /**
   * Set upload event (executed after each schedule entry scrapped).
   */
  protected initTransportEvent() {
    void this.scrapper?.on(
      ScrapperEvent.FETCH,
      (htmlId: string, context: any) => void this.transporter(htmlId, context)
    )
  }

  /**
   * Entrypoint of the scrapper.
   */
  async start() {
    this.logger.info('Starting manager...')
    this.logger.debug({
      msg: 'Runtime',
      scrapper: this.scrapper?.constructor.name,
      node: process.version,
      version: process.env.npm_package_version,
    })

    this.initTransportEvent()
    this.client
      .subscribe<DispositionsSubscription, DispositionsSubscriptionVariables>({
        query: tasksSubscription,
        variables: {
          tasksDispositionsScraperId: 'jeabc smuka scrapper',
        },
      })
      .subscribe(({ data }) => {
        if (!data) return
        if (!data.tasksDispositions) return
        void this.manageScrap(data.tasksDispositions)
      })
    this.logger.info('Manager started and is ready!')

    // code related to the gentle connection drop
    //this.socket.once('disconnect', (reason) => {
    //  this.logger.warn('Disconnected from hypervisor (%s)!', reason.toString())
    //  process.exit()
    //})
  }
}
