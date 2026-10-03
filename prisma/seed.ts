import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Salário & Proventos', color: '#10B981', icon: 'Briefcase', type: 'income' },
  { id: 'cat-2', name: 'Investimentos & Dividendos', color: '#06B6D4', icon: 'TrendingUp', type: 'income' },
  { id: 'cat-3', name: 'Outras Receitas & Pix', color: '#14B8A6', icon: 'ArrowDownLeft', type: 'income' },
  { id: 'cat-4', name: 'Moradia (Aluguel & Contas)', color: '#F43F5E', icon: 'Home', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-5', name: 'Alimentação & Mercado', color: '#F97316', icon: 'ShoppingBag', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-6', name: 'Transporte & Combustível', color: '#EAB308', icon: 'Car', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-7', name: 'Lazer & Restaurantes', color: '#8B5CF6', icon: 'Utensils', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-8', name: 'Saúde & Farmácia', color: '#EC4899', icon: 'HeartPulse', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-9', name: 'Educação & Cursos', color: '#3B82F6', icon: 'GraduationCap', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-10', name: 'Compras & E-commerce', color: '#F43F5E', icon: 'ShoppingBag', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-11', name: 'Transferências & Pessoal', color: '#6366F1', icon: 'Send', type: 'expense', monthlyBudget: 0 },
  { id: 'cat-12', name: 'Pagamento de Fatura & Cartão', color: '#E11D48', icon: 'CreditCard', type: 'expense', monthlyBudget: 0 },
]

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Seed de categorias globais do sistema
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        type: cat.type,
      },
      create: {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        type: cat.type,
        monthlyBudget: cat.monthlyBudget,
        userId: null,
      },
    })
  }
  console.log('✅ Categorias padrão semeadas com sucesso!')

  // Cria um usuário demo opcional
  const demoEmail = 'demo@financehub.com'
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  })

  if (!existingUser) {
    const passwordHash = await bcrypt.hash('123456', 10)
    const user = await prisma.user.create({
      data: {
        name: 'Usuário Demonstração',
        email: demoEmail,
        passwordHash,
      },
    })

    // Cria contas iniciais
    const contaCorrente = await prisma.account.create({
      data: {
        name: 'Nubank Principal',
        type: 'checking',
        balance: 3500.0,
        institution: 'Nubank',
        color: '#8B5CF6',
        userId: user.id,
      },
    })

    await prisma.account.create({
      data: {
        name: 'Reserva & Investimentos',
        type: 'investment',
        balance: 15200.0,
        institution: 'XP Investimentos',
        color: '#06B6D4',
        userId: user.id,
      },
    })

    // Cria uma meta exemplo
    await prisma.goal.create({
      data: {
        title: 'Reserva de Emergência (6 meses)',
        targetAmount: 25000,
        currentAmount: 15200,
        deadline: '2026-12-31',
        category: 'Segurança Financeira',
        color: '#10B981',
        userId: user.id,
      },
    })

    // Cria transações de exemplo
    await prisma.transaction.create({
      data: {
        description: 'Salário Mensal',
        amount: 6000.0,
        type: 'income',
        categoryId: 'cat-1',
        accountId: contaCorrente.id,
        date: '2026-10-01',
        status: 'completed',
        paymentMethod: 'pix',
        userId: user.id,
      },
    })

    await prisma.transaction.create({
      data: {
        description: 'Supermercado Mensal',
        amount: 850.0,
        type: 'expense',
        categoryId: 'cat-5',
        accountId: contaCorrente.id,
        date: '2026-10-02',
        status: 'completed',
        paymentMethod: 'debit',
        userId: user.id,
      },
    })

    console.log('✅ Usuário demo criado: demo@financehub.com (senha: 123456)')
  }

  console.log('🎉 Seed finalizado com sucesso!')
}

seed()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
