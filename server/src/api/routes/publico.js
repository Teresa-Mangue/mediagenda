import { Router } from 'express';
import { servicos, repositorios } from '../../container.js';
import { chaveData } from '../../utils/tempo.js';
import { ErroValidacao } from '../../utils/erros.js';

export const publicoRouter = Router();

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
    maxConsultasPacienteMedico: c.numero('max_consultas_paciente_medico')
  });
});

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
