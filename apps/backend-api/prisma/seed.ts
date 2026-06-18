import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('Seed cancelado: variavel de ambiente ADMIN_PASSWORD nao definida. Configure no .env ou no painel do Render.');
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 10)

  // sobrescreve credenciais e nivel de acesso caso o admin ja exista
  await prisma.usuario.upsert({
    where: { login: 'lucas.mello' },
    update: {
      password: hash,
      nivel: 'ADM_MASTER',
    },
    create: {
      login:    'lucas.mello',
      password: hash,
      nome:     'Lucas Mello',
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
