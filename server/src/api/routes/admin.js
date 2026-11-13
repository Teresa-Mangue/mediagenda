import { Router } from 'express';
import { assincrono, autenticar, exigirPerfil } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';
import { ErroValidacao } from '../../utils/erros.js';

export const adminRouter = Router();
adminRouter.use(autenticar, exigirPerfil('admin'));

adminRouter.get('/resumo', (req, res) => {
  res.json(servicos.relatorioService.resumo());
});

adminRouter.get('/relatorios', (req, res) => {
  res.json({
    resumo: servicos.relatorioService.resumo(),
    consultas: servicos.relatorioService.listarConsultas(req.query)
  });
});

adminRouter.get('/relatorios/export.csv', (req, res) => {
  const csv = servicos.relatorioService.exportarCsv(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mediagenda-relatorio.csv"');
  res.send('\uFEFF' + csv);
});

adminRouter.get('/auditoria', (req, res) => {
  res.json(repositorios.auditoria.listar({ limite: Number(req.query.limite) || 200, acao: req.query.acao }));
});

adminRouter.get('/eventos', (req, res) => {
  res.json({
    eventos: repositorios.eventos.listar({ limite: Number(req.query.limite) || 100 }),
    resumo: repositorios.eventos.resumo()
  });
});

adminRouter.get('/validacoes', (req, res) => {
  res.json(repositorios.traces.listar({ limite: Number(req.query.limite) || 30 }));
});

adminRouter.get('/utilizadores', (req, res) => {
  res.json(repositorios.utilizadores.listar({
    perfil: req.query.perfil,
    estadoAprovacao: req.query.estadoAprovacao
  }));
});

// --- Aprovação de contas (secretárias e médicos) ---------------------------
adminRouter.get('/aprovacoes', (req, res) => {
  res.json(servicos.authService.listarPendentes(req.utilizador));
});

adminRouter.post('/utilizadores/:id/aprovar', assincrono(async (req, res) => {
  res.json(await servicos.authService.aprovar(req.params.id, req.utilizador));
}));

adminRouter.post('/utilizadores/:id/recusar', assincrono(async (req, res) => {
  res.json(await servicos.authService.recusar(req.params.id, req.utilizador, req.body?.motivo ?? null));
}));

adminRouter.get('/notificacoes', (req, res) => {
  res.json(repositorios.notificacoes.listarTodas({ limite: Number(req.query.limite) || 100 }));
});

adminRouter.post('/especialidades', (req, res) => {
  const { nome, descricao, duracaoPadraoMin } = req.body || {};
  if (!nome) throw new ErroValidacao('O nome da especialidade é obrigatório.');
  const id = repositorios.especialidades.criar({ nome, descricao, duracaoPadraoMin });
  res.status(201).json(repositorios.especialidades.porId(id));
});

adminRouter.put('/especialidades/:id', (req, res) => {
  const { nome, descricao, duracaoPadraoMin, ativo } = req.body || {};
  if (!nome) throw new ErroValidacao('O nome da especialidade é obrigatório.');
  repositorios.especialidades.atualizar(req.params.id, { nome, descricao, duracaoPadraoMin, ativo });
  res.json(repositorios.especialidades.porId(req.params.id));
});

adminRouter.get('/configuracoes', (req, res) => {
  res.json(servicos.configuracao.todas());
});

adminRouter.put('/configuracoes', (req, res) => {
  const alteracoes = req.body || {};
  for (const [chave, valor] of Object.entries(alteracoes)) {
    servicos.configuracao.atualizar(chave, valor);
  }
  res.json({ mensagem: 'Configuração actualizada.', configuracoes: servicos.configuracao.todas() });
});

adminRouter.post('/medicos', assincrono(async (req, res) => {
  const { nome, email, password, telefone, numeroRegisto, localizacao, especialidades } = req.body || {};
  if (!nome || !email || !numeroRegisto) {
    throw new ErroValidacao('Nome, e-mail e número de registo são obrigatórios.');
  }
  const resultado = await servicos.authService.registar({
    nome, email, password: password || 'MediAgenda123', perfil: 'medico',
    telefone, numeroRegisto, localizacao, especialidades,
    aprovadoPor: req.utilizador
  });
  res.status(201).json({ ...resultado, mensagem: 'Médico registado e aprovado. Palavra-passe inicial: ' + (password || 'MediAgenda123') });
}));

adminRouter.patch('/medicos/:id/desativar', assincrono(async (req, res) => {
  const resultado = await servicos.medicoService.desactivar(req.params.id, req.utilizador);
  servicos.auditoriaService.registar({
    utilizadorId: req.utilizador.id, acao: 'MEDICO_DESATIVADO', entidade: 'medico',
    entidadeId: Number(req.params.id), detalhes: resultado
  });
  res.json({ ...resultado, mensagem: 'Médico desactivado e consultas futuras canceladas (RN-08).' });
}));
