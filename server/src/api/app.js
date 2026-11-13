import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tratarErros, limitarPedidos } from './middleware.js';
import { authRouter } from './routes/auth.js';
import { publicoRouter } from './routes/publico.js';
import { consultasRouter } from './routes/consultas.js';
import { medicoRouter } from './routes/medico.js';
import { pacientesRouter } from './routes/pacientes.js';
import { adminRouter } from './routes/admin.js';
import { secretariaRouter } from './routes/secretaria.js';
import { notificacoesRouter } from './routes/notificacoes.js';
import { demoRouter } from './routes/demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// O build do Vite (web/vite.config.js) gera os ficheiros em `server/public`.
const publicDir = path.resolve(__dirname, '..', '..', 'public');

export function criarApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  app.use(limitarPedidos({ janelaMs: 60_000, maximo: 300 }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, servico: 'MediAgenda API', hora: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', publicoRouter);
  app.use('/api/consultas', consultasRouter);
  app.use('/api/medico', medicoRouter);
  app.use('/api/pacientes', pacientesRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/secretaria', secretariaRouter);
  app.use('/api/notificacoes', notificacoesRouter);
  app.use('/api/demo', demoRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({ erro: 'Endpoint não encontrado.', codigo: 'ENDPOINT_NAO_ENCONTRADO' });
  });

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(tratarErros);
  return app;
}
