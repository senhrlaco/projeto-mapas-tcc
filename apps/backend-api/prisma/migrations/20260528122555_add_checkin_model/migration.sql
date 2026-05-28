-- CreateTable
CREATE TABLE "checkins" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isMocked" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "alertaGeofence" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);
