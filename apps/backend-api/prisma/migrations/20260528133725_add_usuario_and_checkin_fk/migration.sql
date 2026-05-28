-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE INDEX "checkins_colaboradorId_createdAt_idx" ON "checkins"("colaboradorId", "createdAt");

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
