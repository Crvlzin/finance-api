import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middlewares/auth.js'

export async function accountsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/accounts
  app.get('/', async (request, reply) => {
    const accounts = await prisma.account.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(accounts)
  })

  // POST /api/accounts
  app.post('/', async (request, reply) => {
    const createAccountSchema = z.object({
      name: z.string().min(1, 'O nome da conta é obrigatório'),
      type: z.enum(['checking', 'credit_card', 'investment', 'cash']),
      balance: z.coerce.number().default(0),
      institution: z.string().min(1, 'A instituição é obrigatória'),
      color: z.string().default('#3b82f6'),
      creditLimit: z.coerce.number().optional().nullable(),
    })

    const data = createAccountSchema.parse(request.body)

    const account = await prisma.account.create({
      data: {
        name: data.name,
        type: data.type,
        balance: data.balance,
        institution: data.institution,
        color: data.color,
        creditLimit: data.creditLimit ?? null,
        userId: request.userId,
      },
    })

    return reply.status(201).send(account)
  })

  // PUT /api/accounts/:id
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid('ID inválido'),
    })
    const { id } = paramsSchema.parse(request.params)

    const updateAccountSchema = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(['checking', 'credit_card', 'investment', 'cash']).optional(),
      balance: z.coerce.number().optional(),
      institution: z.string().min(1).optional(),
      color: z.string().optional(),
      creditLimit: z.coerce.number().optional().nullable(),
    })

    const data = updateAccountSchema.parse(request.body)

    const existing = await prisma.account.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Conta não encontrada.',
      })
    }

    const updated = await prisma.account.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.balance !== undefined && { balance: data.balance }),
        ...(data.institution && { institution: data.institution }),
        ...(data.color && { color: data.color }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
      },
    })

    return reply.send(updated)
  })

  // DELETE /api/accounts/:id
  app.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid('ID inválido'),
    })
    const { id } = paramsSchema.parse(request.params)

    const existing = await prisma.account.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Conta não encontrada.',
      })
    }

    await prisma.account.delete({
      where: { id },
    })

    return reply.status(204).send()
  })
}
