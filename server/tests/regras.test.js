/**
 * Testes de integração dos requisitos de negócio (RN-01…RN-09), da
 * cadeia de validação, dos eventos e da façade.
 *
 * Cada teste parte de uma base de demonstração limpa.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  repor, fechar, proximoDiaUtil, utilizadorPorEmail,
  medicoPorEmail, pacientePorEmail, criarConsulta
} from './helpers.js';

let ctx;

beforeEach(async () => {
  ctx = await repor();
});

after(async () => {
  await fechar();
});

const especialidadeDe = (medico, nome) =>
  medico.especialidades.find((e) => e.nome === nome) || medico.especialidades[0];

async function simular({ paciente, medico, dataHora, especialidade }) {
  const admin = await utilizadorPorEmail('admin@mediagenda.co.mz');
  return ctx.agendamentoFacade.simular({
    utilizador: admin,
    pacienteId: paciente.id,
    medicoId: medico.id,
    especialidadeId: especialidadeDe(medico, especialidade).id,
    dataHora: new Date(dataHora).toISOString()
  });
}

test('RN-01 — marcação com menos de 1h de antecedência é recusada no primeiro elo', async () => {
  const maria = await pacientePorEmail('maria@example.com');
  const joaquim = await medicoPorEmail('joaquim@mediagenda.co.mz');

  const resultado = await simular({
    paciente: maria,
    medico: joaquim,
    dataHora: new Date(Date.now() + 30 * 60 * 1000)
  });

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.falhouEm, 'RN-01');
  assert.equal(resultado.passos.length, 1, 'a cadeia pára no primeiro elo');

  const trace = ctx.repositorios.traces.porId(resultado.traceId);
  assert.equal(trace.resultado, 'rejeitado');
  assert.equal(trace.detalhes.tipo, 'simulacao');
  assert.equal(trace.detalhes.rejeitado, resultado.mensagem);
});

test('RN-09 — horário fora do funcionamento da clínica é recusado', async () => {
  const maria = await pacientePorEmail('maria@example.com');
  const joaquim = await medicoPorEmail('joaquim@mediagenda.co.mz');

  const resultado = await simular({
    paciente: maria,
    medico: joaquim,
    dataHora: proximoDiaUtil(2, '22:00')
  });

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.falhouEm, 'RN-09');
  assert.match(resultado.mensagem, /horário/i);
  const codigos = resultado.passos.map((p) => p.codigo);
  assert.deepEqual(codigos, ['RN-01', 'RN-09']);
});

test('RN-09 — bloqueio/férias do médico impede a marcação', async () => {
  const maria = await pacientePorEmail('maria@example.com');
  const joaquim = await medicoPorEmail('joaquim@mediagenda.co.mz');
  const dia = proximoDiaUtil(24, '10:00');

  ctx.repositorios.medicos.criarBloqueio(
    joaquim.id,
    proximoDiaUtil(24, '08:00').toISOString(),
    proximoDiaUtil(24, '18:00').toISOString(),
    'Formação'
  );

  const resultado = await simular({ paciente: maria, medico: joaquim, dataHora: dia });
  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.falhouEm, 'RN-09');
  assert.match(resultado.mensagem, /bloqueio|férias/i);
});

test('RN-05 — duas consultas simultâneas do mesmo médico entram em conflito', async () => {
  const maria = await pacientePorEmail('maria@example.com');
  const joaquim = await medicoPorEmail('joaquim@mediagenda.co.mz');
  const dia = proximoDiaUtil(25, '10:00');

  await criarConsulta({
    pacienteEmail: 'carlos@example.com',
    medicoEmail: 'joaquim@mediagenda.co.mz',
    especialidade: 'Ortopedia',
    dataHora: dia
  });

  const resultado = await simular({ paciente: maria, medico: joaquim, dataHora: dia });

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.falhouEm, 'RN-05');
  assert.deepEqual(resultado.passos.map((p) => p.codigo), ['RN-01', 'RN-09', 'RN-05']);
  assert.match(resultado.mensagem, /já tem uma consulta/i);
});

test('RN-03 — limite diário do médico interrompe a cadeia', async () => {
  const maria = await pacientePorEmail('maria@example.com');
  const antonio = await medicoPorEmail('antonio@mediagenda.co.mz');
  const dia = proximoDiaUtil(20, '08:00');

  ctx.repositorios.medicos.atualizar(antonio.id, { max_consultas_dia: 2 });
  await criarConsulta({
    pacienteEmail: 'carlos@example.com',
    medicoEmail: 'antonio@mediagenda.co.mz',
    especialidade: 'Cardiologia',
    dataHora: dia
  });
  const noveHoras = new Date(dia); noveHoras.setHours(9, 0, 0, 0);
  await criarConsulta({
    pacienteEmail: 'ana@example.com',
    medicoEmail: 'antonio@mediagenda.co.mz',
    especialidade: 'Cardiologia',
    dataHora: noveHoras
  });

  const dezHoras = new Date(dia); dezHoras.setHours(10, 0, 0, 0);
  const resultado = await simular({ paciente: maria, medico: antonio, dataHora: dezHoras });

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.falhouEm, 'RN-03');
  assert.match(resultado.mensagem, /limite de 2 consultas/i);
  assert.equal(resultado.passos.at(-1).detalhe, 'Consultas no dia: 2/2.');
});

test('RN-06 — paciente não pode exceder 3 consultas futuras com o mesmo médico', async () => {
  const maria = await pacientePorEmail('maria@example.com');
  const joaquim = await medicoPorEmail('joaquim@mediagenda.co.mz');

  for (const offset of [30, 34, 38]) {
    await criarConsulta({
      pacienteEmail: 'maria@example.com',
      medicoEmail: 'joaquim@mediagenda.co.mz',
      especialidade: 'Ortopedia',
      dataHora: proximoDiaUtil(offset, '10:00')
    });
  }

  const resultado = await simular({
    paciente: maria,
    medico: joaquim,
    dataHora: proximoDiaUtil(42, '10:00')
  });

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.falhouEm, 'RN-06');
  assert.deepEqual(
    resultado.passos.map((p) => p.codigo),
    ['RN-01', 'RN-09', 'RN-05', 'RN-03', 'RN-06']
  );
  assert.match(resultado.mensagem, /3 consultas futuras/i);
});

test('façade — marcação válida cria consulta pendente, evento, notificação e auditoria', async () => {
  const mariaPaciente = await pacientePorEmail('maria@example.com');
  const maria = await utilizadorPorEmail('maria@example.com');
  const joaquim = await medicoPorEmail('joaquim@mediagenda.co.mz');
  const admin = await utilizadorPorEmail('admin@mediagenda.co.mz');
  const dia = proximoDiaUtil(15, '10:00');
  const ortopedia = especialidadeDe(joaquim, 'Ortopedia');

  const resultado = await ctx.agendamentoFacade.marcar({
    utilizador: admin,
    pacienteId: mariaPaciente.id,
    medicoId: joaquim.id,
    especialidadeId: ortopedia.id,
    dataHora: dia.toISOString(),
    ip: '127.0.0.1'
  });

  assert.equal(resultado.consulta.estado, 'pendente');
  assert.equal(resultado.consulta.duracao_min, 90);
  assert.equal(resultado.validacao.aprovado, true);
  assert.deepEqual(
    resultado.validacao.passos.map((p) => p.codigo),
    ['RN-01', 'RN-09', 'RN-05', 'RN-03', 'RN-06']
  );

  // EDA: evento persistido como outbox + 3 consumidores independentes.
  const evento = ctx.repositorios.eventos.listar({ limite: 50 })
    .find((e) => e.tipo === 'ConsultaCriada' && Number(e.payload.consulta.id) === Number(resultado.consulta.id));
  assert.ok(evento, 'evento ConsultaCriada publicado');
  assert.deepEqual(
    evento.consumos.map((c) => c.consumidor).sort(),
    ['AuditoriaService', 'NotificacaoService', 'RelatorioService']
  );
  assert.ok(evento.consumos.every((c) => c.estado === 'sucesso'));

  // Observer de notificações criou mensagem para o paciente.
  const notificacoes = ctx.repositorios.notificacoes.listarTodas({ limite: 100 });
  assert.ok(notificacoes.some(
    (n) => Number(n.consulta_id) === Number(resultado.consulta.id)
      && n.evento === 'ConsultaCriada'
      && Number(n.utilizador_id) === Number(maria.id)
  ));

  // Auditoria directa da façade.
  const auditoria = ctx.repositorios.auditoria.listar({ limite: 100 });
  assert.ok(auditoria.some(
    (a) => a.acao === 'CONSULTA_CRIADA' && Number(a.entidade_id) === Number(resultado.consulta.id)
  ));

  // RN-07: confirmação passa a confirmada e publica evento.
  const confirmada = await ctx.servicos.consultaService.confirmar(maria, resultado.consulta.id);
  assert.equal(confirmada.estado, 'confirmada');
  assert.ok(ctx.repositorios.eventos.listar({ limite: 50 })
    .some((e) => e.tipo === 'ConsultaConfirmada'
      && Number(e.payload.consulta.id) === Number(resultado.consulta.id)));

  // RN-02: com 15 dias de antecedência o cancelamento não é tardio.
  const cancelamento = await ctx.agendamentoFacade.cancelar({
    utilizador: maria,
    consultaId: resultado.consulta.id,
    motivo: 'Viagem',
    ip: '127.0.0.1'
  });
  assert.equal(cancelamento.consulta.estado, 'cancelada');
  assert.equal(cancelamento.tardio, false);
  assert.equal(cancelamento.consulta.cancelamento_tardio, 0);
});

test('RN-07 — confirmação expirada é recusada e o scheduler liberta a vaga', async () => {
  const maria = await utilizadorPorEmail('maria@example.com');
  const consultaId = await criarConsulta({
    pacienteEmail: 'maria@example.com',
    medicoEmail: 'joaquim@mediagenda.co.mz',
    especialidade: 'Ortopedia',
    dataHora: proximoDiaUtil(16, '10:00'),
    estado: 'pendente',
    prazoConfirmacao: new Date(Date.now() - 60 * 1000).toISOString()
  });

  await assert.rejects(
    () => ctx.servicos.consultaService.confirmar(maria, consultaId),
    (erro) => erro.codigo === 'PRAZO_CONFIRMACAO_EXPIRADO' && erro.status === 409
  );

  const expiradas = await ctx.servicos.consultaService.expirarPendentes();
  assert.ok(expiradas.some((c) => Number(c.id) === Number(consultaId)));
  const consulta = ctx.repositorios.consultas.porId(consultaId);
  assert.equal(consulta.estado, 'cancelada');
  assert.match(consulta.motivo_cancelamento, /RN-07/);
  assert.ok(ctx.repositorios.eventos.listar({ limite: 50 })
    .some((e) => e.tipo === 'ConsultaExpirada'
      && Number(e.payload.consulta.id) === Number(consultaId)));
});

test('RN-02 — cancelamento com menos de 24h é marcado e incrementa o contador do paciente', async () => {
  const maria = await utilizadorPorEmail('maria@example.com');
  const paciente = await pacientePorEmail('maria@example.com');
  const consultaId = await criarConsulta({
    pacienteEmail: 'maria@example.com',
    medicoEmail: 'joaquim@mediagenda.co.mz',
    especialidade: 'Ortopedia',
    dataHora: new Date(Date.now() + 2 * 60 * 60 * 1000)
  });

  const resultado = await ctx.agendamentoFacade.cancelar({
    utilizador: maria,
    consultaId,
    motivo: 'Imprevisto',
    ip: '127.0.0.1'
  });

  assert.equal(resultado.tardio, true);
  assert.equal(resultado.consulta.cancelamento_tardio, 1);
  const depois = ctx.repositorios.pacientes.porId(paciente.id);
  assert.equal(Number(depois.cancelamentos_tardios), Number(paciente.cancelamentos_tardios) + 1);

  const historico = ctx.repositorios.consultas.historico(consultaId);
  assert.ok(historico.some((h) => h.estado_novo === 'cancelada' && /tardio/i.test(h.motivo || '')));
});

test('permissões — paciente não cancela consulta de outro paciente', async () => {
  const maria = await utilizadorPorEmail('maria@example.com');
  const consultaAna = await criarConsulta({
    pacienteEmail: 'ana@example.com',
    medicoEmail: 'joaquim@mediagenda.co.mz',
    especialidade: 'Ortopedia',
    dataHora: proximoDiaUtil(17, '10:00')
  });

  await assert.rejects(
    () => ctx.agendamentoFacade.cancelar({ utilizador: maria, consultaId: consultaAna, motivo: 'x' }),
    (erro) => erro.status === 403 && erro.codigo === 'PROIBIDO'
  );
});

test('permissões — médico só acede às consultas da sua agenda', async () => {
  const antonio = await utilizadorPorEmail('antonio@mediagenda.co.mz');
  const consultaJoaquim = await criarConsulta({
    pacienteEmail: 'maria@example.com',
    medicoEmail: 'joaquim@mediagenda.co.mz',
    especialidade: 'Ortopedia',
    dataHora: proximoDiaUtil(18, '10:00')
  });

  assert.throws(
    () => ctx.servicos.consultaService.obterComPermissao(antonio, consultaJoaquim),
    (erro) => erro.status === 403
  );
});

test('Singleton — configuração é partilhada e os valores são os do seed', async () => {
  const { ConfiguracaoSistema } = await import('../src/config/ConfiguracaoSistema.js');
  assert.equal(ConfiguracaoSistema.obterInstancia(), ctx.servicos.configuracao);
  assert.equal(ctx.servicos.configuracao.numero('antecedencia_minima_horas'), 1);
  assert.deepEqual(ctx.servicos.configuracao.lista('dias_funcionamento'), [1, 2, 3, 4, 5]);
  assert.equal(ctx.servicos.configuracao.obter('horario_fim'), '20:00');
});

test('relatórios — resumo, filtros e exportação CSV', () => {
  const resumo = ctx.servicos.relatorioService.resumo();
  assert.equal(resumo.total, 15);
  assert.equal(resumo.confirmadas + resumo.pendentes + resumo.realizadas + resumo.canceladas, resumo.total);
  assert.ok(resumo.medicosAtivos >= 16, 'rede nacional de médicos activos');
  assert.ok(Array.isArray(resumo.porEspecialidade));

  const csv = ctx.servicos.relatorioService.exportarCsv();
  const linhas = csv.split('\r\n');
  assert.equal(linhas.length, 16, 'cabeçalho + 15 consultas');
  assert.match(linhas[0], /^"ID";"Data";"Hora"/);
  assert.ok(linhas.slice(1).every((l) => l.split(';').length === 9));

  const filtrado = ctx.servicos.relatorioService.listarConsultas({ estado: 'cancelada' });
  assert.ok(filtrado.length >= 1);
  assert.ok(filtrado.every((c) => c.estado === 'cancelada'));

  const versaoAntes = resumo.versaoCache;
  ctx.servicos.relatorioService.invalidarCache();
  assert.equal(ctx.servicos.relatorioService.resumo().versaoCache, versaoAntes + 1);
});
