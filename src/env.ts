import 'dotenv/config'
import { z } from 'zod'

const DEFAULT_DATABASE_URL =
  'postgresql://neondb_owner:npg_8vNfgQ0mhHDo@ep-broad-river-b4n510wm-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.string().default('development'),
  JWT_SECRET: z.string().default('supersecret-finance-hub-jwt-token-key-2025'),
  DATABASE_URL: z.string().default(DEFAULT_DATABASE_URL),
  CORS_ORIGIN: z.string().default('*'),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('❌ Variáveis de ambiente inválidas:', _env.error.format())
  throw new Error('Variáveis de ambiente inválidas.')
}

export const env = _env.data
