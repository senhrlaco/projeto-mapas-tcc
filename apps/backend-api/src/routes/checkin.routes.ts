
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { haversine } from '../utils/haversine';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// middleware de validacao do token exclusivo para o roteador de checkin
async function verificarTokenCheckin(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nao autorizado' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.usuario = decoded;
    // permite que agentes criem checkins livremente
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

// destino fixo para simulacao — substituir por busca no banco
const DESTINO_SIMULADO = {
  clienteId: 'cliente-simulado-001',
  latitude: -23.5505,
  longitude: -46.6333,
};

const RAIO_MAXIMO_METROS = 100;

router.post('/', verificarTokenCheckin, async (req: any, res: any) => {
  try {
    const { clienteId, latitude, longitude, status, observacao, isMocked } = req.body;
    const colaboradorId = req.usuario.id;

    // gps simulado e tratado como fraude — rejeita imediatamente
    if (isMocked === true) {
      return res.status(403).json({
        error: 'Fraude de GPS detectada.',
        code: 'GPS_MOCKED',
      });
    }

    const distanciaMetros = haversine(
      latitude,
      longitude,
      DESTINO_SIMULADO.latitude,
      DESTINO_SIMULADO.longitude,
    );

    const alertaGeofence = distanciaMetros > RAIO_MAXIMO_METROS;
    const statusGeofence = alertaGeofence ? 'FORA_DA_CERCA' : 'VALIDO';

    const checkin = await prisma.checkin.create({
      data: {
        colaboradorId,
        clienteId,
        latitude,
        longitude,
        isMocked,
        status: status || statusGeofence,
        alertaGeofence,
        observacao,
      },
    });

    // atualiza o status master do cliente ao receber checkin da rua
    await prisma.client.update({
      where: { id: clienteId },
      data: { statusOperacional: status || statusGeofence },
    });

    return res.status(201).json(checkin);

  } catch (error) {
    console.error('[checkin.routes] Erro ao processar check-in:', error);
    return res.status(500).json({ error: 'Erro interno ao processar o check-in.' });
  }
});

router.get('/', verificarTokenCheckin, async (req: any, res: any) => {
  try {
    // inclui os relacionamentos de agente e cliente na query
    const checkins = await prisma.checkin.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        colaborador: { select: { nome: true } },
        cliente: { select: { name: true } },
      },
    });
    return res.json(checkins);
  } catch (error) {
    console.error('[checkin.routes] Erro ao buscar check-ins:', error);
    return res.status(500).json({ error: 'Erro ao buscar historico de check-ins.' });
  }
});

export default router;
