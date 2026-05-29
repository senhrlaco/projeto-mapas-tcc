
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const router = Router()
const prisma = new PrismaClient()

// POST /api/auth/login — valida credenciais e devolve token
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { username },
    })

    if (!usuario) {
      return res.status(401).json({ error: 'Usuario nao encontrado.' })
    }

    // compara a senha digitada com o hash salvo
    const senhaValida = await bcrypt.compare(password, usuario.password)

    if (!senhaValida) {
      return res.status(401).json({ error: 'Senha incorreta.' })
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
    console.error('[auth.routes] erro no login:', error)
    return res.status(500).json({ error: 'Erro interno no servidor.' })
  }
})

export default router
