// src/routes/auth.routes.ts

import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const router = Router()
const prisma = new PrismaClient()

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body

  try {
    // busca o usuario pelo login
    const usuario = await prisma.usuario.findUnique({
      where: { username },
    })

    if (!usuario) {
      return res.status(401).json({ error: 'Usuario nao encontrado.' })
    }

    // compara a senha com o hash salvo no banco
    const senhaValida = await bcrypt.compare(password, usuario.password)

    if (!senhaValida) {
      return res.status(401).json({ error: 'Senha incorreta.' })
    }

    // gera o token com id e role no payload
    const token = jwt.sign(
      { id: usuario.id, role: usuario.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' },
    )

    // devolve o token pro front junto com os dados basicos do usuario
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
