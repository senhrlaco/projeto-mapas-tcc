import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('Seed cancelado: variavel de ambiente ADMIN_PASSWORD nao definida.');
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 10)

  // sobrescreve credenciais e nivel de acesso caso o admin ja exista
  await prisma.usuario.upsert({
    where: { login: 'admin' },
    update: {
      password: hash,
      nivel: 'ADM_MASTER',
    },
    create: {
      login:    'admin',
      password: hash,
      nome:     'Administrador Master',
      nivel:     'ADM_MASTER',
    },
  })

  console.log('Seed: usuario ADM_MASTER atualizado/criado com sucesso.')
}

main()
  .catch((e) => {
    console.error('Seed falhou:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
