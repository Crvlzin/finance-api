import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middlewares/auth.js'

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/analytics/summary?month=YYYY-MM
  app.get('/summary', async (request, reply) => {
    const querySchema = z.object({
      month: z.string().optional(), // YYYY-MM
    })

    const { month } = querySchema.parse(request.query)

    const where: any = {
      userId: request.userId,
      status: 'completed',
    }

    if (month) {
      where.date = { startsWith: month }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
    })

    let totalIncome = 0
    let totalExpense = 0
    let investmentsTotal = 0

    for (const t of transactions) {
      if (t.type === 'income') {
        totalIncome += t.amount
      } else if (t.type === 'expense') {
        totalExpense += t.amount
        if (
          t.category?.name.toLowerCase().includes('investimento') ||
          t.category?.name.toLowerCase().includes('aporte')
        ) {
          investmentsTotal += t.amount
        }
      }
    }

    const netSavings = totalIncome - totalExpense
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

    return reply.send({
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      savingsRate: Math.round(savingsRate * 10) / 10,
      investmentsTotal: Math.round(investmentsTotal * 100) / 100,
    })
  })

  // GET /api/analytics/cash-flow
  app.get('/cash-flow', async (request, reply) => {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: request.userId,
        status: 'completed',
      },
      include: { category: true },
      orderBy: { date: 'asc' },
    })

    // Agrupa por mês YYYY-MM
    const monthGroups: Record<string, { receitas: number; despesas: number; investimentos: number }> = {}

    for (const t of transactions) {
      const monthKey = t.date.substring(0, 7) // 'YYYY-MM'
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = { receitas: 0, despesas: 0, investimentos: 0 }
      }

      if (t.type === 'income') {
        monthGroups[monthKey].receitas += t.amount
      } else if (t.type === 'expense') {
        monthGroups[monthKey].despesas += t.amount
        if (
          t.category?.name.toLowerCase().includes('investimento') ||
          t.category?.name.toLowerCase().includes('aporte')
        ) {
          monthGroups[monthKey].investimentos += t.amount
        }
      }
    }

    const points = Object.entries(monthGroups).map(([month, values]) => ({
      month,
      receitas: Math.round(values.receitas),
      despesas: Math.round(values.despesas),
      investimentos: Math.round(values.investimentos),
    }))

    return reply.send(points)
  })

  // GET /api/analytics/category-expenses?month=YYYY-MM
  app.get('/category-expenses', async (request, reply) => {
    const querySchema = z.object({
      month: z.string().optional(),
    })

    const { month } = querySchema.parse(request.query)

    const where: any = {
      userId: request.userId,
      type: 'expense',
      status: 'completed',
    }

    if (month) {
      where.date = { startsWith: month }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
    })

    const categoryMap: Record<string, { amount: number; color: string }> = {}
    let totalExpense = 0

    for (const t of transactions) {
      const catName = t.category?.name || 'Outros'
      const catColor = t.category?.color || '#94a3b8'

      if (!categoryMap[catName]) {
        categoryMap[catName] = { amount: 0, color: catColor }
      }

      categoryMap[catName].amount += t.amount
      totalExpense += t.amount
    }

    const result = Object.entries(categoryMap).map(([category, info]) => ({
      category,
      amount: Math.round(info.amount * 100) / 100,
      color: info.color,
      percentage: totalExpense > 0 ? Math.round((info.amount / totalExpense) * 1000) / 10 : 0,
    }))

    result.sort((a, b) => b.amount - a.amount)

    return reply.send(result)
  })
}
