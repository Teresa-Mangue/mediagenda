/**
 * Testes das regras de aprovação de contas e das permissões operacionais
 * pedidas para a defesa:
 *  - médico só entra após aprovação da secretária;
 *  - secretária só entra após autorização do administrador;
 *  - a secretária não pode aprovar outras secretárias;
 *  - confirmação de consulta por link de e-mail (token de uso único);
 *  - o administrador não confirma, cancela, reagenda nem realiza consultas.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { repor, fechar, utilizadorPorEmail, criarConsulta } from './helpers.js';

let ctx;

beforeEach(async () => {
  ctx = await repor();
});

after(async () => {
  await fechar();
});

const registar = (dados) => ctx.servicos.authService.registar({
  password: 'Segredo@123',
  ...dados
});

test('registo de médico fica pendente e o login é recusado até a secretária aprovar', async () => {
  const registo = await registar({
    nome: 'Dr. Novo Candidato',
    email: 'novo.medico@example.com',
    perfil: 'medico',
    numeroRegisto: 'OM-99001',
    localizacao: 'Clínica MediAgenda — Beira',
    especialidades: ['Pediatria']
  });

  assert.equal(registo.estadoAprovacao, 'pendente');
  assert.throws(
    () => ctx.servicos.authService.login({ email: 'novo.medico@example.com', password: 'Segredo@123' }),
    (erro) => erro.codigo === 'APROVACAO_PENDENTE' && erro.status === 403
  );

  const secretaria = await utilizadorPorEmail('secretaria@mediagenda.co.mz');
  const pendentes = ctx.servicos.authService.listarPendentes(secretaria);
  const alvo = pendentes.find((u) => u.email === 'novo.medico@example.com');
  assert.ok(alvo, 'a secretária deve ver o médico pendente');
  assert.equal(alvo.numero_registo, 'OM-99001');

  await ctx.servicos.authService.aprovar(alvo.id, secretaria);

  const sessao = ctx.servicos.authService.login({
    email: 'novo.medico@example.com',
    password: 'Segredo@123'
  });
  assert.equal(sessao.utilizador.perfil, 'medico');
  assert.ok(sessao.utilizador.medicoId);
});

test('registo de secretária fica pendente até o administrador autorizar', async () => {
  const registo = await registar({
    nome: 'Nova Secretária',
    email: 'nova.secretaria@example.com',
    perfil: 'secretario',
    telefone: '+258 84 111 2222'
  });
  assert.equal(registo.estadoAprovacao, 'pendente');
  assert.throws(
    () => ctx.servicos.authService.login({ email: 'nova.secretaria@example.com', password: 'Segredo@123' }),
    (erro) => erro.codigo === 'APROVACAO_PENDENTE'
  );

  const admin = await utilizadorPorEmail('admin@mediagenda.co.mz');
  const pendentes = ctx.servicos.authService.listarPendentes(admin);
  const alvo = pendentes.find((u) => u.email === 'nova.secretaria@example.com');
  assert.ok(alvo);

  await ctx.servicos.authService.aprovar(alvo.id, admin);
  const sessao = ctx.servicos.authService.login({
    email: 'nova.secretaria@example.com',
    password: 'Segredo@123'
  });
  assert.equal(sessao.utilizador.perfil, 'secretario');
});

test('a secretária não pode aprovar outras secretárias', async () => {
  const secretaria = await utilizadorPorEmail('secretaria@mediagenda.co.mz');
  const pendente = ctx.repositorios.utilizadores.listar({ perfil: 'secretario', estadoAprovacao: 'pendente' })[0];
  assert.ok(pendente, 'o seed inclui uma secretária pendente');

  await assert.rejects(
    () => ctx.servicos.authService.aprovar(pendente.id, secretaria),
    (erro) => erro.status === 403
  );

  // A lista da secretária só contém médicos.
  const lista = ctx.servicos.authService.listarPendentes(secretaria);
  assert.ok(lista.every((u) => u.perfil === 'medico'));
});

test('criação directa pela secretária dispensa aprovação', async () => {
  const secretaria = await utilizadorPorEmail('secretaria@mediagenda.co.mz');
  const resultado = await registar({
    nome: 'Dr. Criado pela Secretária',
    email: 'criado.secretaria@example.com',
    perfil: 'medico',
    numeroRegisto: 'OM-99002',
    localizacao: 'Clínica MediAgenda — Nampula',
    especialidades: ['Clínica Geral'],
    aprovadoPor: secretaria
  });

  assert.equal(resultado.estadoAprovacao, 'aprovada');
  const sessao = ctx.servicos.authService.login({
    email: 'criado.secretaria@example.com',
    password: 'Segredo@123'
  });
  assert.equal(sessao.utilizador.perfil, 'medico');
});

test('confirmação por link usa um token de uso único', async () => {
  const consulta = await criarConsulta({
    pacienteEmail: 'maria@example.com',
    medicoEmail: 'antonio@mediagenda.co.mz',
    especialidade: 'Cardiologia',
    dataHora: new Date(Date.now() + 48 * 60 * 60 * 1000),
    estado: 'pendente'
  });
  ctx.repositorios.consultas.atualizar(consulta, { token_confirmacao: 'token-de-teste' });

  const previa = ctx.servicos.consultaService.obterPorLink(consulta, 'token-de-teste');
  assert.equal(previa.id, consulta);

  const confirmada = await ctx.servicos.consultaService.confirmarPorLink(consulta, 'token-de-teste');
  assert.equal(confirmada.estado, 'confirmada');

  assert.throws(
    () => ctx.servicos.consultaService.obterPorLink(consulta, 'token-de-teste'),
    (erro) => erro.status === 404
  );
});

test('o administrador não cancela nem marca consultas como realizadas', async () => {
  const admin = await utilizadorPorEmail('admin@mediagenda.co.mz');
  const consulta = await criarConsulta({
    pacienteEmail: 'maria@example.com',
    medicoEmail: 'antonio@mediagenda.co.mz',
    especialidade: 'Cardiologia',
    dataHora: new Date(Date.now() + 72 * 60 * 60 * 1000),
    estado: 'confirmada'
  });

  await assert.rejects(
    () => ctx.servicos.agendamentoFacade.cancelar({
      utilizador: admin, consultaId: consulta, motivo: 'tentativa do admin'
    }),
    (erro) => erro.status === 403
  );

  await assert.rejects(
    () => ctx.servicos.consultaService.realizar(admin, consulta),
    (erro) => erro.status === 403
  );

  await assert.rejects(
    () => ctx.servicos.agendamentoFacade.reagendar({
      utilizador: admin,
      consultaId: consulta,
      novaDataHora: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString()
    }),
    (erro) => erro.status === 403
  );
});

test('secretária e médico realizam; o paciente não', async () => {
  const secretaria = await utilizadorPorEmail('secretaria@mediagenda.co.mz');
  const medico = await utilizadorPorEmail('antonio@mediagenda.co.mz');
  const paciente = await utilizadorPorEmail('maria@example.com');

  const doMedico = await criarConsulta({
    pacienteEmail: 'maria@example.com',
    medicoEmail: 'antonio@mediagenda.co.mz',
    especialidade: 'Cardiologia',
    dataHora: new Date(Date.now() + 48 * 60 * 60 * 1000),
    estado: 'confirmada'
  });
  const daSecretaria = await criarConsulta({
    pacienteEmail: 'carlos@example.com',
    medicoEmail: 'antonio@mediagenda.co.mz',
    especialidade: 'Cardiologia',
    dataHora: new Date(Date.now() + 96 * 60 * 60 * 1000),
    estado: 'confirmada'
  });
  const doPaciente = await criarConsulta({
    pacienteEmail: 'maria@example.com',
    medicoEmail: 'joaquim@mediagenda.co.mz',
    especialidade: 'Ortopedia',
    dataHora: new Date(Date.now() + 120 * 60 * 60 * 1000),
    estado: 'confirmada'
  });

  assert.equal((await ctx.servicos.consultaService.realizar(medico, doMedico)).estado, 'realizada');
  assert.equal((await ctx.servicos.consultaService.realizar(secretaria, daSecretaria)).estado, 'realizada');
  await assert.rejects(
    () => ctx.servicos.consultaService.realizar(paciente, doPaciente),
    (erro) => erro.status === 403
  );
});
