import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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

app.use(['/api/checkin', '/api/checkins'], checkinRoutes);

app.get('/api/ping', async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    return res.json({ status: 'ok', totalUsuarios: usersCount });
  } catch (error) {
    console.error('[GET /api/ping]', error);
    return res.status(500).json({ error: 'erro interno no ping' });
  }
});

app.get('/api/visitas', async (req, res) => {
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

app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await prisma.client.findMany({
      select: { id: true, name: true, latitude: true, longitude: true, statusOperacional: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(clientes);
  } catch (error) {
    console.error('[GET /clientes]', error);
    return res.status(500).json({ error: 'erro ao buscar clientes' });
  }
});
// utiliza function para forcar o hoisting no typescript
async function verificarToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nao autorizado' });
  try {
    // valida assinatura do jwt
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido' });
  }
}
app.get('/api/usuarios', verificarToken, async (req: any, res: any) => {
  try {
    // oculta painel para agentes
    if (req.usuario.nivel === 'AGENTE') {
      return res.status(403).json({ error: 'Acesso negado para agentes' });
    }
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nome: true, login: true, nivel: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(usuarios);
  } catch (error) {
    console.error('[GET /usuarios]', error);
    return res.status(500).json({ error: 'erro ao buscar usuarios' });
  }
});

app.post('/api/usuarios', verificarToken, async (req: any, res: any) => {
  try {
    const { name, email, password, nivel } = req.body;

    if (req.usuario.nivel === 'AGENTE') {
      return res.status(403).json({ error: 'Privilegio insuficiente' });
    }

    // bloqueia criacao de hierarquia superior
    const pesoLogado = PESOS_RBAC[req.usuario.nivel] || 0;
    const pesoAlvo = PESOS_RBAC[nivel] || 0;

    if (pesoLogado <= pesoAlvo) {
      return res.status(403).json({ error: 'Privilegio insuficiente' });
    }

    // criptografa a senha antes de salvar no banco
    const hashedPassword = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome: name,
        login: email,
        password: hashedPassword,
        nivel: nivel ?? 'AGENTE',
      },
    });
    return res.json(usuario);
  } catch (error) {
    console.error('[POST /usuarios]', error);
    return res.status(500).json({ error: 'erro ao criar usuario' });
  }
});

// valida hierarquia por sistema de pesos
const PESOS_RBAC: Record<string, number> = {
  'ADM_MASTER': 100,
  'GESTOR': 50,
  'AGENTE': 10,
};



app.put('/api/usuarios/:id', verificarToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, email, nivel } = req.body;
    const loggedUser = req.usuario;

    const targetUser = await prisma.usuario.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'Usuario nao encontrado' });

    // valida hierarquia por sistema de pesos
    const pesoLogado = PESOS_RBAC[loggedUser.nivel] || 0;
    const pesoAlvo = PESOS_RBAC[targetUser.nivel] || 0;

    if (loggedUser.id !== targetUser.id && pesoLogado <= pesoAlvo) {
      return res.status(403).json({ error: 'Sem permissao para editar este usuario' });
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nome: name,
        login: email,
        nivel,
      },
    });
    return res.json(usuario);
  } catch (error) {
    console.error('[PUT /usuarios/:id]', error);
    return res.status(500).json({ error: 'erro ao atualizar usuario' });
  }
});

app.delete('/api/usuarios/:id', verificarToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const loggedUser = req.usuario;

    const targetUser = await prisma.usuario.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'Usuario nao encontrado' });

    // impede usuario de excluir a propria conta
    if (loggedUser.id === targetUser.id) {
      return res.status(403).json({ error: 'Privilegio insuficiente' });
    }

    if (loggedUser.nivel === 'AGENTE') {
      return res.status(403).json({ error: 'Privilegio insuficiente' });
    }

    // gestor so pode deletar nivel agente
    if (loggedUser.nivel === 'GESTOR' && targetUser.nivel !== 'AGENTE') {
      return res.status(403).json({ error: 'Privilegio insuficiente' });
    }

    await prisma.usuario.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error('[DELETE /usuarios/:id]', error);
    return res.status(500).json({ error: 'erro ao excluir usuario' });
  }
});

app.patch('/api/usuarios/:id/senha', verificarToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { novaSenha } = req.body;
    const loggedUser = req.usuario;

    if (loggedUser.nivel !== 'ADM_MASTER') {
      return res.status(403).json({ error: 'Privilegio insuficiente' });
    }

    const targetUser = await prisma.usuario.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'Usuario nao encontrado' });

    // criptografa nova senha
    const hashedPassword = await bcrypt.hash(novaSenha, 10);

    await prisma.usuario.update({
      where: { id },
      data: { password: hashedPassword }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[PATCH /usuarios/:id/senha]', error);
    return res.status(500).json({ error: 'erro ao alterar senha' });
  }
});

app.post('/api/clientes', async (req, res) => {
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

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Tentativa de exclusão do ID:", id);
    // garante exclusao do registro no banco via prisma
    await prisma.client.delete({ where: { id } });
    return res.status(200).send();
  } catch (error: any) {
    console.error('[DELETE /clientes/:id]', error);
    return res.status(500).json({ error: error.message });
  }
});

app.patch('/api/clientes/:id/status', verificarToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status, statusOperacional } = req.body;
    
    // Suporta ambas as nomenclaturas de payload
    const novoStatus = status || statusOperacional;

    if (req.usuario.nivel === 'AGENTE') {
      return res.status(403).json({ error: 'Acesso negado para agentes' });
    }

    const statusPermitidos = ['PENDENTE', 'NECESSITA_DOCUMENTACAO', 'TOKEN_ENTREGUE'];

    if (!statusPermitidos.includes(novoStatus)) {
      return res.status(400).json({ error: 'status invalido' });
    }

    // atualiza status do cliente via painel web
    const cliente = await prisma.client.update({
      where: { id },
      data: { statusOperacional: novoStatus }
    });

    return res.status(200).json(cliente);
  } catch (error) {
    console.error('[PATCH /clientes/:id/status]', error);
    return res.status(500).json({ error: 'Erro ao atualizar status do cliente' });
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    const { userId, clientId, capturedLat, capturedLng, gpsAccuracy, isMocked, statusOperacional } = req.body;

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

    // define status operacional no banco
    if (statusOperacional) {
      await prisma.client.update({
        where: { id: clientId },
        data: { statusOperacional }
      });
    }

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