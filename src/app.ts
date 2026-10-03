import fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from './env.js'
import { errorHandler } from './middlewares/error-handler.js'
import { authRoutes } from './routes/auth.routes.js'
import { accountsRoutes } from './routes/accounts.routes.js'
import { categoriesRoutes } from './routes/categories.routes.js'
import { transactionsRoutes } from './routes/transactions.routes.js'
import { goalsRoutes } from './routes/goals.routes.js'
import { analyticsRoutes } from './routes/analytics.routes.js'
import { csvRoutes } from './routes/csv.routes.js'

export function buildApp() {
  const app = fastify({
    logger: env.NODE_ENV === 'development',
  })

  // CORS
  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  })

  // JWT
  app.register(jwt, {
    secret: env.JWT_SECRET,
  })

  // Multipart para upload de arquivos CSV
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  })

  // Swagger Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: 'FinanceHub API',
        description: 'Documentação da API REST do FinanceHub',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Servidor Local',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  })

  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  })

  // Global Error Handler
  app.setErrorHandler(errorHandler)

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // Rotas da API
  app.register(authRoutes, { prefix: '/api/auth' })
  app.register(accountsRoutes, { prefix: '/api/accounts' })
  app.register(categoriesRoutes, { prefix: '/api/categories' })
  app.register(transactionsRoutes, { prefix: '/api/transactions' })
  app.register(goalsRoutes, { prefix: '/api/goals' })
  app.register(analyticsRoutes, { prefix: '/api/analytics' })
  app.register(csvRoutes, { prefix: '/api/csv' })

  // Compatibilidade com ANALYTICS_BASE_URL (http://localhost:8000/api ou direto)
  app.register(csvRoutes, { prefix: '/csv' })

  return app
}
