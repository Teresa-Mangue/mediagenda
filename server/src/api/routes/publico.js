import { Router } from 'express';
import { assincrono } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';
import { chaveData } from '../../utils/tempo.js';
import { ErroValidacao } from '../../utils/erros.js';

export const publicoRouter = Router();

/** Sedes activas: uma por cidade onde exista pelo menos um médico. */
function sedesAtivas() {
  const mapa = new Map();
  for (const medico of repositorios.medicos.listar()) {
    const localizacao = medico.localizacao || 'Clínica MediAgenda';
    const cidade = localizacao.includes('—')
      ? localizacao.split('—').pop().trim()
      : localizacao.replace(/Clínica MediAgenda/i, '').trim() || localizacao;
    const registo = mapa.get(cidade) || { cidade, medicos: 0, localizacao };
    registo.medicos += 1;
    mapa.set(cidade, registo);
  }
  return [...mapa.values()].sort((a, b) => a.cidade.localeCompare(b.cidade));
}

publicoRouter.get('/clinica', (req, res) => {
  const c = servicos.configuracao;
  res.json({
    nome: c.obter('nome_clinica'),
    horarioInicio: c.obter('horario_inicio'),
    horarioFim: c.obter('horario_fim'),
    diasFuncionamento: c.lista('dias_funcionamento'),
    antecedenciaMinimaHoras: c.numero('antecedencia_minima_horas'),
    cancelamentoLimiteHoras: c.numero('cancelamento_limite_horas'),
    confirmacaoPrazoHoras: c.numero('confirmacao_prazo_horas'),
    maxConsultasDia: c.numero('max_consultas_dia'),
    maxConsultasPacienteMedico: c.numero('max_consultas_paciente_medico'),
    sedes: sedesAtivas()
  });
});

/** Link de confirmação enviado por e-mail: pré-visualização sem sessão. */
publicoRouter.get('/confirmar-consulta', (req, res) => {
  const { id, token } = req.query;
  if (!id || !token) throw new ErroValidacao('Link incompleto: indique id e token.');
  res.json(servicos.consultaService.obterPorLink(id, token));
});

/** Link de confirmação enviado por e-mail: confirma a marcação. */
publicoRouter.post('/confirmar-consulta', assincrono(async (req, res) => {
  const { id, token } = req.body || {};
  if (!id || !token) throw new ErroValidacao('Link incompleto: indique id e token.');
  const consulta = await servicos.consultaService.confirmarPorLink(id, token);
  res.json({ mensagem: 'Consulta confirmada com sucesso.', consulta });
}));

publicoRouter.get('/especialidades', (req, res) => {
  res.json(repositorios.especialidades.listar({ apenasAtivas: true }));
});

publicoRouter.get('/medicos', (req, res) => {
  const { especialidade, nome, localizacao, avaliacaoMin } = req.query;
  res.json(servicos.medicoService.listar({ especialidade, nome, localizacao, avaliacaoMin }));
});

publicoRouter.get('/medicos/:id', (req, res) => {
  res.json(servicos.medicoService.detalhe(req.params.id));
});

publicoRouter.get('/medicos/:id/disponibilidade', (req, res) => {
  const data = req.query.data || chaveData(new Date());
  const slots = servicos.medicoService.disponibilidadeDoDia(req.params.id, data);
  res.json({ data, slots });
});

publicoRouter.get('/medicos/:id/proximos-dias', (req, res) => {
  const quantidade = Math.min(30, Number(req.query.quantidade) || 7);
  res.json(servicos.medicoService.proximosDias(req.params.id, quantidade));
});

publicoRouter.get('/medicos/:id/avaliacoes', (req, res) => {
  const medico = servicos.medicoService.detalhe(req.params.id);
  res.json({
    avaliacaoMedia: medico.avaliacao_media,
    totalAvaliacoes: medico.total_avaliacoes,
    avaliacoes: repositorios.avaliacoes.listarPorMedico(medico.id)
  });
});

publicoRouter.get('/horarios', (req, res) => {
  const { medicoId } = req.query;
  if (!medicoId) throw new ErroValidacao('Indique medicoId.');
  res.json(servicos.medicoService.proximosDias(medicoId, 14));
});
