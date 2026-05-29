import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { calcularDistanciaEmMetros } from './utils/geofencing';
import checkinRoutes from './routes/checkin.routes';
import authRoutes from './routes/auth.routes';

const app = express();
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/checkin', checkinRoutes);

app.get('/ping', async (req, res) => {
  const usersCount = await prisma.user.count();
  return res.json({ status: 'ok', totalUsuarios: usersCount });
});

app.get('/visitas', async (req, res) => {
  try {
    const visitas = await prisma.visit.findMany({
      take: 50,
      orderBy: { serverTimestamp: 'desc' },
      include: {
        user: { select: { name: true } },
        client: { select: { name: true } },
      },
    });
    return res.json(visitas);
  } catch (error) {
    console.error('[GET /visitas]', error);
    return res.status(500).json({ error: 'erro ao buscar visitas' });
  }
});

app.get('/clientes', async (req, res) => {
  try {
    const clientes = await prisma.client.findMany({
      select: { id: true, name: true, latitude: true, longitude: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(clientes);
  } catch (error) {
    console.error('[GET /clientes]', error);
    return res.status(500).json({ error: 'erro ao buscar clientes' });
  }
});

app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nome: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(usuarios);
  } catch (error) {
    console.error('[GET /usuarios]', error);
    return res.status(500).json({ error: 'erro ao buscar usuarios' });
  }
});

app.post('/usuarios', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const usuario = await prisma.usuario.create({
      data: {
        nome: name,
        username: email,
        password,
        role: role ?? 'AGENTE',
      },
    });
    return res.json(usuario);
  } catch (error) {
    console.error('[POST /usuarios]', error);
    return res.status(500).json({ error: 'erro ao criar usuario' });
  }
});

app.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nome: name,
        username: email,
        role,
      },
    });
    return res.json(usuario);
  } catch (error) {
    console.error('[PUT /usuarios/:id]', error);
    return res.status(500).json({ error: 'erro ao atualizar usuario' });
  }
});

app.delete('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.usuario.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error('[DELETE /usuarios/:id]', error);
    return res.status(500).json({ error: 'erro ao excluir usuario' });
  }
});

app.post('/clientes', async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;

    const cliente = await prisma.client.create({
      data: { name, address, latitude, longitude }
    });

    return res.json(cliente);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'deu ruim ao criar cliente' });
  }
});

app.delete('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // garante exclusao do registro no banco via prisma
    await prisma.client.delete({ where: { id } });
    return res.status(200).send();
  } catch (error) {
    console.error('[DELETE /clientes/:id]', error);
    return res.status(400).json({ error: 'erro ao excluir: cliente nao encontrado ou com vinculos ativos' });
  }
});

app.post('/checkin', async (req, res) => {
  try {
    const { userId, clientId, capturedLat, capturedLng, gpsAccuracy, isMocked } = req.body;

    // rejeita gps simulado ou precisao ruim
    if (isMocked || gpsAccuracy > 50) {
      return res.status(400).json({
        error: 'fraude detectada ou sinal de gps muito fraco',
        status: 'FRAUDE_DETECTADA'
      });
    }

    const cliente = await prisma.client.findUnique({ where: { id: clientId } });
    if (!cliente) {
      return res.status(404).json({ error: 'cliente nao encontrado' });
    }

    const distancia = calcularDistanciaEmMetros(
      capturedLat,
      capturedLng,
      cliente.latitude,
      cliente.longitude
    );

    const statusCheckin = distancia <= 100 ? 'VALIDO' : 'FORA_DA_CERCA';

    const visita = await prisma.visit.create({
      data: {
        userId, // extrair do token jwt em producao
        clientId,
        capturedLat,
        capturedLng,
        gpsAccuracy,
        distanceToDest: distancia,
        status: statusCheckin,
        isMocked,
        deviceTimestamp: new Date(),
      }
    });

    return res.json({
      mensagem: statusCheckin === 'VALIDO' ? 'Check-in realizado com sucesso' : 'Você está fora do raio permitido',
      distancia: Math.round(distancia) + ' metros',
      status: statusCheckin,
      idVisita: visita.id
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'erro interno no processamento' });
  }
});

const PORT = 3333;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});