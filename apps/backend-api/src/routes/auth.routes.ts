
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const router = Router()
const prisma = new PrismaClient()

// POST /api/auth/login — valida credenciais e devolve token
router.post('/login', async (req: Request, res: Response) => {
  // mapeia a chave para login conforme exigencia do prisma
  const { login, senha } = req.body

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { login },
    })

    // barra execucao se usuario nao existir
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciais invalidas' })
    }

    // compara a senha digitada com o hash salvo
    const senhaValida = await bcrypt.compare(senha, usuario.password)

    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais invalidas' })
    }

    // valida assinatura jwt e chaves de ambiente
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET nao definido no servidor')
    }

    const token = jwt.sign(
      { id: usuario.id, role: usuario.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' },
    )

    return res.status(200).json({
      token,
      nome: usuario.nome,
      role: usuario.role,
    })

  } catch (error) {
    // telemetria de erro para logs do servidor
    console.error("erro critico no login:", error)
    return res.status(500).json({ error: 'Erro interno no servidor' })
  }
})

export default router
