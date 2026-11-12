import { Router } from 'express';
import { assincrono, autenticar } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';
import { ErroNegocio, ErroProibido, ErroValidacao } from '../../utils/erros.js';

export const consultasRouter = Router();
consultasRouter.use(autenticar);

consultasRouter.post('/', assincrono(async (req, res) => {
  const { pacienteId, medicoId, especialidadeId, dataHora } = req.body || {};
  if (!medicoId || !dataHora) throw new ErroValidacao('medicoId e dataHora são obrigatórios.');
  const resultado = await servicos.agendamentoFacade.marcar({
    utilizador: req.utilizador,
    pacienteId,
    medicoId,
    especialidadeId,
    dataHora,
    ip: req.ip
  });
  res.status(201).json(resultado);
}));

consultasRouter.get('/minhas', (req, res) => {
  const { estado, desde, ate } = req.query;
  res.json(servicos.consultaService.listarMinhas(req.utilizador, { estado, desde, ate }));
});

consultasRouter.get('/:id', (req, res) => {
  res.json(servicos.consultaService.obterComPermissao(req.utilizador, req.params.id));
});

consultasRouter.get('/:id/historico', (req, res) => {
  res.json(servicos.consultaService.historico(req.utilizador, req.params.id));
});

consultasRouter.get('/:id/xray', (req, res) => {
  const consulta = servicos.consultaService.obterComPermissao(req.utilizador, req.params.id);
  res.json({
    consulta,
    historico: repositorios.consultas.historico(consulta.id),
    traces: repositorios.traces.porConsulta(consulta.id),
    eventos: repositorios.eventos.listar({ limite: 100 })
      .filter((e) => Number(e.payload?.consulta?.id) === Number(consulta.id))
  });
});

consultasRouter.post('/:id/confirmar', assincrono(async (req, res) => {
  res.json(await servicos.consultaService.confirmar(req.utilizador, req.params.id));
}));

consultasRouter.post('/:id/cancelar', assincrono(async (req, res) => {
  const { motivo } = req.body || {};
  const resultado = await servicos.agendamentoFacade.cancelar({
    utilizador: req.utilizador,
    consultaId: req.params.id,
    motivo,
    ip: req.ip
  });
  res.json(resultado);
}));

consultasRouter.patch('/:id/reagendar', assincrono(async (req, res) => {
  const { dataHora, motivo } = req.body || {};
  if (!dataHora) throw new ErroValidacao('Indique a nova dataHora.');
  const resultado = await servicos.agendamentoFacade.reagendar({
    utilizador: req.utilizador,
    consultaId: req.params.id,
    novaDataHora: dataHora,
    motivo,
    ip: req.ip
  });
  res.json(resultado);
}));

consultasRouter.post('/:id/realizar', assincrono(async (req, res) => {
  res.json(await servicos.consultaService.realizar(req.utilizador, req.params.id));
}));

consultasRouter.post('/:id/avaliar', (req, res) => {
  const consulta = servicos.consultaService.obterComPermissao(req.utilizador, req.params.id);
  if (req.utilizador.perfil === 'paciente' && consulta.paciente_utilizador_id !== req.utilizador.id) {
    throw new ErroProibido();
  }
  if (consulta.estado !== 'realizada') {
    throw new ErroNegocio('Só é possível avaliar consultas realizadas.', { status: 409, codigo: 'ESTADO_INVALIDO' });
  }
  if (repositorios.avaliacoes.porConsulta(consulta.id)) {
    throw new ErroNegocio('Esta consulta já foi avaliada.', { status: 409, codigo: 'JA_AVALIADA' });
  }
  const pontuacao = Number(req.body?.pontuacao);
  if (!Number.isInteger(pontuacao) || pontuacao < 1 || pontuacao > 5) {
    throw new ErroValidacao('A pontuação deve ser um inteiro entre 1 e 5.');
  }
  const id = repositorios.avaliacoes.criar({
    consultaId: consulta.id,
    pontuacao,
    comentario: req.body?.comentario
  });
  servicos.auditoriaService.registar({
    utilizadorId: req.utilizador.id, acao: 'CONSULTA_AVALIADA', entidade: 'consulta',
    entidadeId: consulta.id, detalhes: { pontuacao }
  });
  res.status(201).json({ id, mensagem: 'Avaliação registada.' });
});
