import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('Seed cancelado: variavel de ambiente ADMIN_PASSWORD nao definida.');
    return;
  }

  const jaExiste = await prisma.usuario.findUnique({
    where: { login: 'admin' },
  })

  if (jaExiste) {
    console.log('Seed: usuario admin ja existe, pulando.')
    return
  }

  const hash = await bcrypt.hash(adminPassword, 10)

  await prisma.usuario.create({
    data: {
      login:    'admin',
      password: hash,
      nome:     'Administrador Master',
      nivel:     'ADM_MASTER',
    },
  })

  console.log('Seed: usuario ADM_MASTER criado com sucesso.')
}

main()
  .catch((e) => {
    console.error('Seed falhou:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
