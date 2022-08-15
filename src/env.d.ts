declare namespace NodeJS {
  export interface ProcessEnv {
    PUPPY_GATEWAY?: string
    PINO_LEVEL?: string
    NODE_ENV?: 'production' | 'development'
  }
}
