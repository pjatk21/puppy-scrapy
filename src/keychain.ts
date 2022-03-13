import Conf, { Schema, Options } from 'conf'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { hostname } from 'os'

type ConfigSchemaTypings = {
  uuid: string
  name: string
  secret: string
  creationDate: Date
}

export class Keychain {
  private static generateSecret(name: string) {
    return createHash('sha512')
      .update(randomBytes(512))
      .update(name ?? randomBytes(8))
      .digest('hex')
  }

  static generate(name?: string) {
    const config = new Conf<ConfigSchemaTypings>({
      configName: 'identity',
      cwd: './passport',
    })

    config.set('creationDate', new Date())
    config.set('uuid', randomUUID())
    config.set(
      'name',
      name ??
        process.env.SCRAPPER_NAME ??
        `altscrap-${config.get('uuid').slice(0, 6)} at ${hostname()}`
    )
    config.set('secret', Keychain.generateSecret(config.get('name')))
    console.log(config.path)
  }

  private config: Conf<ConfigSchemaTypings>

  constructor() {
    this.config = new Conf<ConfigSchemaTypings>({
      schema: {
        name: {
          readOnly: true,
        },
        secret: {
          readOnly: true,
        },
        uuid: {
          readOnly: true,
        },
        creationDate: {
          readOnly: true,
        },
      },
      configName: 'identity',
      cwd: './passport',
    })
    if (
      !(
        this.config.get('uuid') ||
        this.config.get('name') ||
        this.config.get('secret')
      )
    )
      throw new Error('Missing identity file')
  }

  read() {
    return {
      uuid: this.config.get('uuid'),
      name: this.config.get('name'),
      secret: this.config.get('secret'),
    }
  }
}
