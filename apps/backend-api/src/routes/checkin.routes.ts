// src/routes/checkin.routes.ts

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { haversine } from '../utils/haversine';

const router = Router();
const prisma = new PrismaClient();

// ponto de entrega fixo pra simular o geofencing (trocar por busca no banco depois)
const DESTINO_SIMULADO = {
  clienteId: 'cliente-simulado-001',
  latitude: -23.5505,
  longitude: -46.6333,
};

const RAIO_MAXIMO_METROS = 100;

router.post('/', async (req: Request, res: Response) => {
  try {
    const { colaboradorId, clienteId, latitude, longitude, isMocked } = req.body;

    // GPS simulado = fraude, recusa na hora
    if (isMocked === true) {
      return res.status(403).json({
        error: 'Fraude de GPS detectada.',
        code: 'GPS_MOCKED',
      });
    }

    // calcula quantos metros o colaborador ta do destino
    const distanciaMetros = haversine(
      latitude,
      longitude,
      DESTINO_SIMULADO.latitude,
      DESTINO_SIMULADO.longitude,
    );

    // define o status: dentro ou fora da cerca de 100m
    const alertaGeofence = distanciaMetros > RAIO_MAXIMO_METROS;
    const status = alertaGeofence ? 'FORA_DA_CERCA' : 'VALIDO';

    // salva o registro no banco
    const checkin = await prisma.checkin.create({
      data: {
        colaboradorId,
        clienteId,
        latitude,
        longitude,
        isMocked,
        status,
        alertaGeofence,
      },
    });

    // devolve o registro criado
    return res.status(201).json(checkin);

  } catch (error) {
    console.error('[checkin.routes] Erro ao processar check-in:', error);
    return res.status(500).json({ error: 'Erro interno ao processar o check-in.' });
  }
});

export default router;
