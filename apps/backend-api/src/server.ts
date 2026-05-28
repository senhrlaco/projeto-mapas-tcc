// src/server.ts
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

// rotas de autenticacao (login jwt)
app.use('/api/auth', authRoutes);

// rotas de check-in logistico (geofencing + antifraude)
app.use('/api/checkin', checkinRoutes);

// rota de saude do servidor
app.get('/ping', async (req, res) => {
  const usersCount = await prisma.user.count();
  return res.json({ status: 'ok', totalUsuarios: usersCount });
});

app.post('/usuarios', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await prisma.user.create({
      data: { name, email, password }
    });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'erro ao criar usuario' });
  }
});

// cria um cliente fake ter um destino
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

// a rota do check-in
app.post('/checkin', async (req, res) => {
  try {
    // pega os dados que o celular vai mandar
    const { userId, clientId, capturedLat, capturedLng, gpsAccuracy, isMocked } = req.body;

    // 1. trava de seguranca basica do celular
    if (isMocked || gpsAccuracy > 50) {
      return res.status(400).json({
        error: 'fraude detectada ou sinal de gps muito fraco',
        status: 'FRAUDE_DETECTADA'
      });
    }

    // 2. busca o cliente no banco pra ver onde o cara devia estar
    const cliente = await prisma.client.findUnique({ where: { id: clientId } });
    if (!cliente) {
      return res.status(404).json({ error: 'cliente nao encontrado' });
    }

    // 3. o calculo
    const distancia = calcularDistanciaEmMetros(
      capturedLat,
      capturedLng,
      cliente.latitude,
      cliente.longitude
    );

    // 4. a regra de negocio dos 100 metros
    const statusCheckin = distancia <= 100 ? 'VALIDO' : 'FORA_DA_CERCA';

    // 5. salva no banco o resultado da operacao
    const visita = await prisma.visit.create({
      data: {
        userId, // em um cenario real pegaria do token jwt
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