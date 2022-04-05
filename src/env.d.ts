declare namespace NodeJS {
  export interface ProcessEnv {
    ALTAPI_GATEWAY?: string
    PINO_LEVEL?: string
    NODE_ENV?: 'production' | 'development'
  }
}
