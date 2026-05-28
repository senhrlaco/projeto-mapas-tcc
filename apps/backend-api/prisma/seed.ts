import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // verifica se o admin ja existe antes de criar
  const jaExiste = await prisma.usuario.findUnique({
    where: { username: 'lucas.mello' },
  })

  if (jaExiste) {
    console.log('Seed: usuario lucas.mello ja existe, pulando.')
    return
  }

  // encripta a senha antes de salvar
  const hash = await bcrypt.hash('123456', 10)

  await prisma.usuario.create({
    data: {
      username: 'lucas.mello',
      password: hash,
      nome:     'Lucas Mello (Admin)',
      role:     'ADM_MASTER',
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
