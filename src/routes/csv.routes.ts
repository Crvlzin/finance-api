import type { FastifyInstance } from 'fastify'
import { parse } from 'csv-parse/sync'

// Regras heurísticas para autoclassificação bancária
const CATEGORY_HEURISTICS: Record<string, string[]> = {
  'cat-5': ['mercado', 'supermercado', 'hortifruti', 'padaria', 'ifood', 'rappi', 'restaurante', 'mcdonalds', 'burger', 'acougue', 'carrefour', 'pao de acucar'],
  'cat-6': ['uber', '99app', 'posto', 'gasolina', 'combustivel', 'estacionamento', 'pedagio', 'sem parar', 'veloe'],
  'cat-4': ['aluguel', 'condominio', 'enel', 'sabesp', 'cpfl', 'luz', 'energia', 'agua', 'gas', 'internet', 'claro', 'vivo', 'tim'],
  'cat-7': ['cinema', 'netflix', 'spotify', 'prime', 'steam', 'playstation', 'bar', 'chopp', 'cervejaria', 'show', 'ingresso'],
  'cat-8': ['farmacia', 'drogaria', 'drogasil', 'droga raia', 'pague menos', 'consulta', 'medico', 'dentista', 'hospital', 'laboratorio', 'fleury'],
  'cat-9': ['udemy', 'alura', 'faculdade', 'escola', 'curso', 'livraria', 'livro', 'amazon books'],
  'cat-10': ['amazon', 'mercado livre', 'magalu', 'shopee', 'shein', 'aliexpress', 'zara', 'renner', 'riachuelo'],
  'cat-1': ['salario', 'remuneracao', 'folha', 'adp', 'pro-labore', 'holerite', 'proventos'],
  'cat-2': ['dividendo', 'jcp', 'rendimento', 'tesouro direto', 'cdb', 'fii', 'acoes', 'xp', 'nuinvest', 'btg'],
  'cat-12': ['fatura', 'pagamento fatura', 'iof', 'anuidade', 'tarifa bancaria'],
}

export async function csvRoutes(app: FastifyInstance) {
  // POST /api/csv/parse (e também acessível na raiz /csv/parse caso chamado diretamente)
  app.post('/parse', async (request, reply) => {
    try {
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'BadRequest',
          message: 'Arquivo CSV não enviado.',
        })
      }

      const fileBuffer = await data.toBuffer()
      const content = fileBuffer.toString('utf-8')

      // Detecta delimitador (, ou ;)
      const firstLine = content.split('\n')[0] || ''
      const delimiter = firstLine.includes(';') ? ';' : ','

      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter,
      })

      const parsedRows = []

      for (let i = 0; i < records.length; i++) {
        const row = records[i] as Record<string, any>
        // Tenta encontrar colunas típicas (data/date, descricao/description/title, valor/amount/value)
        const dateKey = Object.keys(row).find((k) => /data|date/i.test(k))
        const descKey = Object.keys(row).find((k) => /descri|titulo|title|estabelecimento|historico/i.test(k))
        const amountKey = Object.keys(row).find((k) => /valor|amount|value|saldo/i.test(k))

        const rawDate = dateKey ? row[dateKey] : ''
        const rawDesc = descKey ? row[descKey] : 'Transação'
        const rawAmount = amountKey ? row[amountKey] : '0'

        // Trata data YYYY-MM-DD ou DD/MM/YYYY
        let formattedDate = new Date().toISOString().split('T')[0]
        if (rawDate) {
          if (rawDate.includes('/')) {
            const parts = rawDate.split('/')
            if (parts.length === 3) {
              const [day, month, year] = parts
              formattedDate = `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            }
          } else if (rawDate.includes('-')) {
            formattedDate = rawDate.substring(0, 10)
          }
        }

        // Trata valor monetário (e.g. -15,50 ou -15.50 ou 15,50)
        let numAmount = 0
        const cleanedAmountStr = String(rawAmount).replace(/\s/g, '').replace('R$', '').trim()
        const isNegative = cleanedAmountStr.startsWith('-')
        const normalizedNumberStr = cleanedAmountStr.replace('-', '').replace(/\./g, '').replace(',', '.')
        numAmount = parseFloat(normalizedNumberStr) || 0

        const type: 'income' | 'expense' = isNegative || /estorno|reembolso/i.test(rawDesc) ? 'income' : 'expense'

        // Classificação heurística de categoria
        let suggestedCategory = 'cat-11' // Transferências & Pessoal padrão
        const lowerDesc = rawDesc.toLowerCase()

        for (const [catId, keywords] of Object.entries(CATEGORY_HEURISTICS)) {
          if (keywords.some((kw) => lowerDesc.includes(kw))) {
            suggestedCategory = catId
            break
          }
        }

        parsedRows.push({
          id: `csv-${Date.now()}-${i}`,
          date: formattedDate,
          description: rawDesc,
          amount: Math.abs(numAmount),
          type,
          categoryId: suggestedCategory,
          suggestedCategory,
          isAutoClassified: true,
        })
      }

      return reply.send(parsedRows)
    } catch (err: any) {
      request.log.error(err)
      return reply.status(400).send({
        statusCode: 400,
        error: 'BadRequest',
        message: `Falha ao processar arquivo CSV: ${err.message}`,
      })
    }
  })
}
