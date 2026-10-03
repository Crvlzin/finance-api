import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middlewares/auth.js'

export async function categoriesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/categories
  app.get('/', async (request, reply) => {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { userId: request.userId },
          { userId: null },
        ],
      },
      orderBy: { name: 'asc' },
    })

    return reply.send(categories)
  })

  // POST /api/categories
  app.post('/', async (request, reply) => {
    const createCategorySchema = z.object({
      name: z.string().min(1, 'O nome da categoria é obrigatório'),
      color: z.string().default('#10b981'),
      icon: z.string().default('Tag'),
      type: z.enum(['income', 'expense']),
      monthlyBudget: z.coerce.number().optional().nullable(),
    })

    const data = createCategorySchema.parse(request.body)

    const category = await prisma.category.create({
      data: {
        name: data.name,
        color: data.color,
        icon: data.icon,
        type: data.type,
        monthlyBudget: data.monthlyBudget ?? null,
        userId: request.userId,
      },
    })

    return reply.status(201).send(category)
  })

  // PUT /api/categories/:id
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string(),
    })
    const { id } = paramsSchema.parse(request.params)

    const updateCategorySchema = z.object({
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      type: z.enum(['income', 'expense']).optional(),
      monthlyBudget: z.coerce.number().optional().nullable(),
    })

    const data = updateCategorySchema.parse(request.body)

    const existing = await prisma.category.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Categoria personalizada não encontrada ou não pode ser modificada.',
      })
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.color && { color: data.color }),
        ...(data.icon && { icon: data.icon }),
        ...(data.type && { type: data.type }),
        ...(data.monthlyBudget !== undefined && { monthlyBudget: data.monthlyBudget }),
      },
    })

    return reply.send(updated)
  })

  // DELETE /api/categories/:id
  app.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string(),
    })
    const { id } = paramsSchema.parse(request.params)

    const existing = await prisma.category.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Categoria não encontrada ou não pode ser excluída.',
      })
    }

    const linkedTransactions = await prisma.transaction.count({
      where: { categoryId: id },
    })

    if (linkedTransactions > 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'BadRequest',
        message: `Não é possível excluir a categoria pois existem ${linkedTransactions} transações associadas.`,
      })
    }

    await prisma.category.delete({
      where: { id },
    })

    return reply.status(204).send()
  })
}
