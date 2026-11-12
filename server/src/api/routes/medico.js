import { Router } from 'express';
import { assincrono, autenticar, exigirPerfil } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';
import { ErroProibido, ErroValidacao } from '../../utils/erros.js';

export const medicoRouter = Router();
medicoRouter.use(autenticar, exigirPerfil('medico'));

function medicoId(req) {
  if (!req.utilizador.medicoId) throw new ErroProibido('Perfil de médico não encontrado.');
  return req.utilizador.medicoId;
}

medicoRouter.get('/agenda', (req, res) => {
  const { desde, ate } = req.query;
  res.json(servicos.medicoService.agenda(medicoId(req), { desde, ate }));
});

medicoRouter.get('/disponibilidade', (req, res) => {
  const id = medicoId(req);
  res.json({
    disponibilidades: repositorios.medicos.disponibilidades(id),
    bloqueios: repositorios.medicos.bloqueios(id),
    proximosDias: servicos.medicoService.proximosDias(id, 14)
  });
});

medicoRouter.put('/disponibilidade', (req, res) => {
  const lista = Array.isArray(req.body?.lista) ? req.body.lista : [];
  res.json({ disponibilidades: servicos.medicoService.definirDisponibilidades(medicoId(req), lista) });
});

medicoRouter.post('/bloqueios', (req, res) => {
  const { inicio, fim, motivo } = req.body || {};
  if (!inicio || !fim) throw new ErroValidacao('Início e fim são obrigatórios.');
  res.status(201).json(servicos.medicoService.criarBloqueio(medicoId(req), { inicio, fim, motivo }));
});

medicoRouter.delete('/bloqueios/:id', (req, res) => {
  res.json(servicos.medicoService.removerBloqueio(medicoId(req), req.params.id));
});

medicoRouter.get('/pacientes', (req, res) => {
  res.json(servicos.medicoService.pacientes(medicoId(req)));
});

medicoRouter.get('/relatorio', (req, res) => {
  res.json(servicos.relatorioService.relatorioMedico(medicoId(req)));
});

medicoRouter.get('/avaliacoes', (req, res) => {
  res.json(repositorios.avaliacoes.listarPorMedico(medicoId(req)));
});
