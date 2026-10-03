import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middlewares/auth.js'

const DEFAULT_CATEGORIES = [
  { name: 'Salário & Proventos', color: '#10B981', icon: 'Briefcase', type: 'income' },
  { name: 'Investimentos & Dividendos', color: '#06B6D4', icon: 'TrendingUp', type: 'income' },
  { name: 'Outras Receitas & Pix', color: '#14B8A6', icon: 'ArrowDownLeft', type: 'income' },
  { name: 'Moradia (Aluguel & Contas)', color: '#F43F5E', icon: 'Home', type: 'expense', monthlyBudget: 0 },
  { name: 'Alimentação & Mercado', color: '#F97316', icon: 'ShoppingBag', type: 'expense', monthlyBudget: 0 },
  { name: 'Transporte & Combustível', color: '#EAB308', icon: 'Car', type: 'expense', monthlyBudget: 0 },
  { name: 'Lazer & Restaurantes', color: '#8B5CF6', icon: 'Utensils', type: 'expense', monthlyBudget: 0 },
  { name: 'Saúde & Farmácia', color: '#EC4899', icon: 'HeartPulse', type: 'expense', monthlyBudget: 0 },
  { name: 'Educação & Cursos', color: '#3B82F6', icon: 'GraduationCap', type: 'expense', monthlyBudget: 0 },
  { name: 'Compras & E-commerce', color: '#F43F5E', icon: 'ShoppingBag', type: 'expense', monthlyBudget: 0 },
  { name: 'Transferências & Pessoal', color: '#6366F1', icon: 'Send', type: 'expense', monthlyBudget: 0 },
  { name: 'Pagamento de Fatura & Cartão', color: '#E11D48', icon: 'CreditCard', type: 'expense', monthlyBudget: 0 },
]

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', async (request, reply) => {
    const registerBodySchema = z.object({
      name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres'),
      email: z.string().email('E-mail inválido'),
      password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
    })

    const { name, email, password } = registerBodySchema.parse(request.body)
    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'Este e-mail já está cadastrado no sistema.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
    })

    // Cria as categorias padrão para o novo usuário
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        ...cat,
        userId: user.id,
      })),
    })

    const token = app.jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      { expiresIn: '7d' }
    )

    return reply.status(201).send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      token,
    })
  })

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const loginBodySchema = z.object({
      email: z.string().email('E-mail inválido'),
      password: z.string().min(1, 'A senha é obrigatória'),
    })

    const { email, password } = loginBodySchema.parse(request.body)
    const normalizedEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'E-mail ou senha incorretos.',
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'E-mail ou senha incorretos.',
      })
    }

    const token = app.jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      { expiresIn: '7d' }
    )

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      token,
    })
  })

  // GET /api/auth/me
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    })

    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Usuário não encontrado.',
      })
    }

    return reply.send(user)
  })

  // PUT /api/auth/profile
  app.put('/profile', { preHandler: [authenticate] }, async (request, reply) => {
    const updateProfileSchema = z.object({
      name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres').optional(),
      avatar: z.string().optional().nullable(),
      email: z.string().email('E-mail inválido').optional(),
    })

    const data = updateProfileSchema.parse(request.body)

    if (data.email) {
      const emailTaken = await prisma.user.findFirst({
        where: {
          email: data.email.trim().toLowerCase(),
          NOT: { id: request.userId },
        },
      })
      if (emailTaken) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Este e-mail já está sendo utilizado por outro usuário.',
        })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: request.userId },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
        ...(data.email && { email: data.email.trim().toLowerCase() }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    })

    return reply.send(updatedUser)
  })

  // PUT /api/auth/password
  app.put('/password', { preHandler: [authenticate] }, async (request, reply) => {
    const changePasswordSchema = z.object({
      currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
      newPassword: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres'),
    })

    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body)

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
    })

    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Usuário não encontrado.',
      })
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isCurrentValid) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'BadRequest',
        message: 'A senha atual informada está incorreta.',
      })
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: request.userId },
      data: { passwordHash: newPasswordHash },
    })

    return reply.send({ message: 'Senha atualizada com sucesso.' })
  })
}
