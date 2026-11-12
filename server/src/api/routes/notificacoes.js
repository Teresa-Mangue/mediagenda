import { Router } from 'express';
import { autenticar } from '../middleware.js';
import { repositorios } from '../../container.js';

export const notificacoesRouter = Router();
notificacoesRouter.use(autenticar);

notificacoesRouter.get('/', (req, res) => {
  const lista = repositorios.notificacoes.listarPorUtilizador(req.utilizador.id);
  res.json({
    notificacoes: lista,
    naoLidas: lista.filter((n) => !n.lida_em).length
  });
});

notificacoesRouter.patch('/:id/lida', (req, res) => {
  repositorios.notificacoes.marcarLida(req.params.id, req.utilizador.id);
  res.json({ mensagem: 'Notificação marcada como lida.' });
});
