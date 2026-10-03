import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middlewares/auth.js'

export async function goalsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /api/goals
  app.get('/', async (request, reply) => {
    const goals = await prisma.goal.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(goals)
  })

  // POST /api/goals
  app.post('/', async (request, reply) => {
    const createGoalSchema = z.object({
      title: z.string().min(1, 'O título da meta é obrigatório'),
      targetAmount: z.coerce.number().positive('O valor alvo deve ser positivo'),
      currentAmount: z.coerce.number().min(0).default(0),
      deadline: z.string().min(1, 'O prazo da meta é obrigatório'),
      category: z.string().default('Geral'),
      color: z.string().default('#10b981'),
    })

    const data = createGoalSchema.parse(request.body)

    const goal = await prisma.goal.create({
      data: {
        title: data.title,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount,
        deadline: data.deadline,
        category: data.category,
        color: data.color,
        userId: request.userId,
      },
    })

    return reply.status(201).send(goal)
  })

  // PUT /api/goals/:id
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string(),
    })
    const { id } = paramsSchema.parse(request.params)

    const updateGoalSchema = z.object({
      title: z.string().min(1).optional(),
      targetAmount: z.coerce.number().positive().optional(),
      currentAmount: z.coerce.number().min(0).optional(),
      deadline: z.string().optional(),
      category: z.string().optional(),
      color: z.string().optional(),
    })

    const data = updateGoalSchema.parse(request.body)

    const existing = await prisma.goal.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Meta não encontrada.',
      })
    }

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
        ...(data.currentAmount !== undefined && { currentAmount: data.currentAmount }),
        ...(data.deadline && { deadline: data.deadline }),
        ...(data.category && { category: data.category }),
        ...(data.color && { color: data.color }),
      },
    })

    return reply.send(updated)
  })

  // DELETE /api/goals/:id
  app.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string(),
    })
    const { id } = paramsSchema.parse(request.params)

    const existing = await prisma.goal.findFirst({
      where: { id, userId: request.userId },
    })

    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Meta não encontrada.',
      })
    }

    await prisma.goal.delete({
      where: { id },
    })

    return reply.status(204).send()
  })
}
