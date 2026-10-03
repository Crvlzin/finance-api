import type { FastifyReply, FastifyRequest } from 'fastify'

export interface TokenPayload {
  sub: string
  email: string
  name: string
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    userEmail: string
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<TokenPayload>()
    request.userId = payload.sub
    request.userEmail = payload.email
  } catch (err) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Token de autenticação inválido ou expirado.',
    })
  }
}
