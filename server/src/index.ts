import { createApp } from './app.js'

const app = await createApp()

await app.listen({
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 8787),
})
