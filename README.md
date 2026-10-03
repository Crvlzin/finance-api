# FinanceHub API 🚀

Backend robusto e de alta performance desenvolvido com **Node.js, TypeScript, Fastify e Prisma ORM** para o ecossistema FinanceHub.

---

## 🛠️ Tecnologias Utilizadas

- **Runtime & Linguagem**: [Node.js](https://nodejs.org/) com [TypeScript](https://www.typescriptlang.org/)
- **Framework Web**: [Fastify](https://fastify.dev/) (arquitetura assíncrona ultra rápida com suporte nativo a plugins)
- **ORM & Banco de Dados**: [Prisma ORM](https://www.prisma.io/) com **SQLite** (fácil de rodar localmente e pronto para migração PostgreSQL)
- **Autenticação & Segurança**: `@fastify/jwt` (tokens JWT Bearer) e `bcryptjs` (hashing seguro de senhas)
- **Validação de Esquemas**: [Zod](https://zod.dev/)
- **Documentação Interativa**: Swagger OpenAPI 3.0 via `@fastify/swagger-ui` (disponível em `/docs`)
- **Processador de Extratos**: Leitura e autoclassificação de arquivos CSV bancários via `csv-parse`

---

## 📦 Estrutura de Diretórios

```
finance-api/
├── prisma/
│   ├── schema.prisma       # Modelos User, Account, Category, Transaction, Goal
│   └── seed.ts             # Dados iniciais e categorias padrão
├── src/
│   ├── app.ts              # Configuração dos plugins Fastify, CORS e rotas
│   ├── env.ts              # Validação de variáveis de ambiente com Zod
│   ├── server.ts           # Inicialização do servidor HTTP na porta 3333
│   ├── lib/
│   │   └── prisma.ts       # Singleton do PrismaClient
│   ├── middlewares/
│   │   ├── auth.ts         # Hook de autenticação JWT Bearer
│   │   └── error-handler.ts# Tratamento centralizado de erros
│   └── routes/
│       ├── auth.routes.ts  # /api/auth (login, register, me, profile, password)
│       ├── accounts.routes.ts # /api/accounts (CRUD de contas bancárias)
│       ├── categories.routes.ts # /api/categories (CRUD de categorias)
│       ├── transactions.routes.ts # /api/transactions (CRUD e importação em lote)
│       ├── goals.routes.ts # /api/goals (CRUD de metas patrimoniais)
│       ├── analytics.routes.ts # /api/analytics (resumo mensal, fluxo de caixa, despesas)
│       └── csv.routes.ts   # /api/csv/parse (parser inteligente de extratos bancários)
├── .env.example
├── tsconfig.json
└── package.json
```

---

## 🚀 Como Rodar o Projeto

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

### 3. Gerar o Client do Prisma e aplicar o schema ao SQLite
```bash
npx prisma db push
```

### 4. Popular o banco com as categorias padrão e dados demo
```bash
npm run seed
```

### 5. Iniciar o servidor em modo desenvolvimento
```bash
npm run dev
```

O servidor estará rodando em: `http://localhost:3333`
Documentação interativa Swagger: `http://localhost:3333/docs`

---

## 🔐 Endpoints da API

### Autenticação (`/api/auth`)
- `POST /api/auth/register` - Cadastro de novo usuário
- `POST /api/auth/login` - Autenticação e geração de token JWT
- `GET /api/auth/me` - Dados do usuário logado (requer Bearer Token)
- `PUT /api/auth/profile` - Atualização de nome, email e avatar
- `PUT /api/auth/password` - Alteração segura de senha

### Contas Bancárias (`/api/accounts`)
- `GET /api/accounts` - Lista contas do usuário
- `POST /api/accounts` - Criação de conta (corrente, cartão, investimento, dinheiro)
- `PUT /api/accounts/:id` - Atualização de saldo e informações da conta
- `DELETE /api/accounts/:id` - Exclusão de conta

### Categorias (`/api/categories`)
- `GET /api/categories` - Lista categorias padrão e personalizadas
- `POST /api/categories` - Criação de nova categoria
- `PUT /api/categories/:id` - Atualização de categoria personalizada
- `DELETE /api/categories/:id` - Exclusão de categoria

### Transações (`/api/transactions`)
- `GET /api/transactions` - Lista transações (com filtros por mês, tipo, conta, categoria e busca)
- `POST /api/transactions` - Criação de transação (com recalculo automático de saldo)
- `POST /api/transactions/import` - Importação em lote
- `PUT /api/transactions/:id` - Edição de transação
- `DELETE /api/transactions/:id` - Exclusão com ajuste reverso de saldo

### Metas & Reserva (`/api/goals`)
- `GET /api/goals` - Lista de objetivos financeiros
- `POST /api/goals` - Criação de meta
- `PUT /api/goals/:id` - Atualização de meta
- `DELETE /api/goals/:id` - Exclusão de meta

### Análises & Métricas (`/api/analytics`)
- `GET /api/analytics/summary?month=YYYY-MM` - Resumo mensal consolidado
- `GET /api/analytics/cash-flow` - Histórico de fluxo de caixa
- `GET /api/analytics/category-expenses?month=YYYY-MM` - Distribuição por categoria

### Extratos Bancários (`/api/csv`)
- `POST /api/csv/parse` - Upload e autoclassificação de extratos CSV
