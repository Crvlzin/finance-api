import { buildApp } from './app.js'
import { env } from './env.js'

async function main() {
  const app = buildApp()

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    })
    console.log(`🚀 Servidor FinanceHub API rodando em ${address}`)
    console.log(`📑 Documentação interativa disponível em ${address}/docs`)
  } catch (err) {
    console.error('❌ Erro ao iniciar o servidor:', err)
    process.exit(1)
  }
}

main()
