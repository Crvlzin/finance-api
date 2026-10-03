import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middlewares/auth.js'

export async function transactionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/transactions
  app.get('/', async (request, reply) => {
    const querySchema = z.object({
      month: z.string().optional(), // YYYY-MM
      type: z.enum(['income', 'expense', 'transfer']).optional(),
      accountId: z.string().optional(),
      categoryId: z.string().optional(),
      search: z.string().optional(),
    })

    const { month, type, accountId, categoryId, search } = querySchema.parse(request.query)

    const where: any = {
      userId: request.userId,
    }

    if (month) {
      where.date = {
        startsWith: month,
      }
    }

    if (type) {
      where.type = type
    }

    if (accountId) {
      where.accountId = accountId
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      where.description = {
        contains: search,
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
        account: {
          select: { id: true, name: true, color: true, institution: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    const formatted = transactions.map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      categoryId: t.categoryId,
      categoryName: t.category?.name || 'Sem categoria',
      accountId: t.accountId,
      accountName: t.account?.name || 'Sem conta',
      date: t.date,
      status: t.status,
      paymentMethod: t.paymentMethod,
      notes: t.notes || undefined,
    }))

    return reply.send(formatted)
  })

  // POST /api/transactions
  app.post('/', async (request, reply) => {
    const createTxSchema = z.object({
      description: z.string().min(1, 'Descrição é obrigatória'),
      amount: z.coerce.number().positive('O valor deve ser maior que zero'),
      type: z.enum(['income', 'expense', 'transfer']),
      categoryId: z.string().min(1, 'Categoria é obrigatória'),
      accountId: z.string().min(1, 'Conta é obrigatória'),
      date: z.string().min(1, 'Data é obrigatória'),
      status: z.enum(['completed', 'pending']).default('completed'),
      paymentMethod: z.enum(['credit_card', 'debit', 'pix', 'bank_slip', 'cash']).default('pix'),
      notes: z.string().optional().nullable(),
    })

    const data = createTxSchema.parse(request.body)

    // Verifica se a conta pertence ao usuário
    const account = await prisma.account.findFirst({
      where: { id: data.accountId, userId: request.userId },
    })

    if (!account) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Conta de destino não encontrada.',
      })
    }

    // Cria a transação e atualiza o saldo da conta em transação atômica
    const result = await prisma.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          description: data.description,
          amount: data.amount,
          type: data.type,
          categoryId: data.categoryId,
          accountId: data.accountId,
          date: data.date,
          status: data.status,
          paymentMethod: data.paymentMethod,
          notes: data.notes ?? null,
          userId: request.userId,
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      })

      // Atualiza o saldo se a transação estiver completada
      if (data.status === 'completed') {
        const balanceChange = data.type === 'income' ? data.amount : -data.amount
        await tx.account.update({
          where: { id: data.accountId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        })
      }

      return newTransaction
    })

    return reply.status(201).send({
      id: result.id,
      description: result.description,
      amount: result.amount,
      type: result.type,
      categoryId: result.categoryId,
      categoryName: result.category?.name || 'Sem categoria',
      accountId: result.accountId,
      accountName: result.account?.name || 'Sem conta',
      date: result.date,
      status: result.status,
      paymentMethod: result.paymentMethod,
      notes: result.notes || undefined,
    })
  })

  // POST /api/transactions/import (importação em lote)
  app.post('/import', async (request, reply) => {
    const importSchema = z.object({
      transactions: z.array(
        z.object({
          description: z.string().min(1),
          amount: z.coerce.number().positive(),
          type: z.enum(['income', 'expense', 'transfer']),
          categoryId: z.string().min(1),
          accountId: z.string().min(1),
          date: z.string().min(1),
          status: z.enum(['completed', 'pending']).default('completed'),
          paymentMethod: z.enum(['credit_card', 'debit', 'pix', 'bank_slip', 'cash']).default('pix'),
          notes: z.string().optional().nullable(),
        })
      ),
    })

    const { transactions } = importSchema.parse(request.body)

    if (transactions.length === 0) {
      return reply.send({ count: 0, transactions: [] })
    }

    const createdList = await prisma.$transaction(async (tx) => {
      const items = []
      for (const item of transactions) {
        const created = await tx.transaction.create({
          data: {
            ...item,
            notes: item.notes ?? null,
            userId: request.userId,
          },
          include: {
            category: { select: { name: true } },
            account: { select: { name: true } },
          },
        })

        if (item.status === 'completed') {
          const balanceChange = item.type === 'income' ? item.amount : -item.amount
          await tx.account.update({
            where: { id: item.accountId },
            data: { balance: { increment: balanceChange } },
          })
        }

        items.push({
          id: created.id,
          description: created.description,
          amount: created.amount,
          type: created.type,
          categoryId: created.categoryId,
          categoryName: created.category?.name || 'Sem categoria',
          accountId: created.accountId,
          accountName: created.account?.name || 'Sem conta',
          date: created.date,
          status: created.status,
          paymentMethod: created.paymentMethod,
          notes: created.notes || undefined,
        })
      }
      return items
    })

    return reply.status(201).send({
      count: createdList.length,
      transactions: createdList,
    })
  })

  // PUT /api/transactions/:id
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string(),
    })
    const { id } = paramsSchema.parse(request.params)

    const updateTxSchema = z.object({
      description: z.string().min(1).optional(),
      amount: z.coerce.number().positive().optional(),
      type: z.enum(['income', 'expense', 'transfer']).optional(),
      categoryId: z.string().optional(),
      accountId: z.string().optional(),
      date: z.string().optional(),
      status: z.enum(['completed', 'pending']).optional(),
      paymentMethod: z.enum(['credit_card', 'debit', 'pix', 'bank_slip', 'cash']).optional(),
      notes: z.string().optional().nullable(),
    })

    const data = updateTxSchema.parse(request.body)

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Transação não encontrada.',
      })
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Se alterou valor ou status, reverte o impacto anterior na conta
      if (existing.status === 'completed') {
        const revertBalance = existing.type === 'income' ? -existing.amount : existing.amount
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: revertBalance } },
        })
      }

      const newStatus = data.status ?? existing.status
      const newType = data.type ?? existing.type
      const newAmount = data.amount ?? existing.amount
      const newAccountId = data.accountId ?? existing.accountId

      if (newStatus === 'completed') {
        const newBalanceChange = newType === 'income' ? newAmount : -newAmount
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { increment: newBalanceChange } },
        })
      }

      return tx.transaction.update({
        where: { id },
        data: {
          ...(data.description && { description: data.description }),
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.type && { type: data.type }),
          ...(data.categoryId && { categoryId: data.categoryId }),
          ...(data.accountId && { accountId: data.accountId }),
          ...(data.date && { date: data.date }),
          ...(data.status && { status: data.status }),
          ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      })
    })

    return reply.send({
      id: updated.id,
      description: updated.description,
      amount: updated.amount,
      type: updated.type,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name || 'Sem categoria',
      accountId: updated.accountId,
      accountName: updated.account?.name || 'Sem conta',
      date: updated.date,
      status: updated.status,
      paymentMethod: updated.paymentMethod,
      notes: updated.notes || undefined,
    })
  })

  // DELETE /api/transactions/:id
  app.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string(),
    })
    const { id } = paramsSchema.parse(request.params)

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Transação não encontrada.',
      })
    }

    await prisma.$transaction(async (tx) => {
      if (existing.status === 'completed') {
        const revertBalance = existing.type === 'income' ? -existing.amount : existing.amount
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: revertBalance } },
        })
      }

      await tx.transaction.delete({
        where: { id },
      })
    })

    return reply.status(204).send()
  })
}
