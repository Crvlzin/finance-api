import { buildApp } from '../src/app.js'

let app: any

export default async function handler(req: any, res: any) {
  try {
    if (!app) {
      app = buildApp()
      await app.ready()
    }

    // Se a Vercel reescreveu req.url, restaura a URL original da requisição
    if (req.headers['x-forwarded-url']) {
      try {
        const fullUrl = new URL(req.headers['x-forwarded-url'] as string, 'http://localhost')
        req.url = fullUrl.pathname + fullUrl.search
      } catch {
        // mantém req.url inalterado em caso de parse inválido
      }
    }

    app.server.emit('request', req, res)
  } catch (err: any) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        statusCode: 500,
        error: 'Vercel Serverless Function Error',
        message: err?.message || 'Erro ao inicializar Fastify na Vercel',
      })
    )
  }
}
