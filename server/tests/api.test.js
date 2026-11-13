/**
 * Testes da API HTTP: autenticação, RBAC, endpoints públicos/demo,
 * notificações e exportação CSV. Usa o `fetch` nativo do Node contra
 * um servidor Express efémero.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { repor, fechar, proximoDiaUtil } from './helpers.js';

let ctx;
let servidor;
let base;

before(async () => {
  ctx = await repor();
  const app = ctx.criarApp();
  servidor = app.listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  if (servidor) await new Promise((resolve) => servidor.close(resolve));
  await fechar();
});

async function pedir(rota, { metodo = 'GET', corpo, token } = {}) {
  const headers = {};
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const resposta = await fetch(`${base}${rota}`, {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo)
  });
  const texto = await resposta.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { dados = texto; }
  return { status: resposta.status, headers: resposta.headers, dados };
}

async function entrar(email, password) {
  const { status, dados } = await pedir('/api/auth/login', {
    metodo: 'POST',
    corpo: { email, password }
  });
  assert.equal(status, 200, `login de ${email}`);
  return dados.token;
}

test('GET /api/health responde com o estado do serviço', async () => {
  const { status, dados } = await pedir('/api/health');
  assert.equal(status, 200);
  assert.equal(dados.ok, true);
  assert.equal(dados.servico, 'MediAgenda API');
});

test('login válido devolve token e /auth/me identifica o perfil', async () => {
  const token = await entrar('admin@mediagenda.co.mz', 'Admin@123');
  assert.ok(token);

  const { status, dados } = await pedir('/api/auth/me', { token });
  assert.equal(status, 200);
  assert.equal(dados.utilizador.perfil, 'admin');
  assert.equal(dados.utilizador.email, 'admin@mediagenda.co.mz');
});

test('login inválido responde 401 sem revelar qual o campo errado', async () => {
  const { status, dados } = await pedir('/api/auth/login', {
    metodo: 'POST',
    corpo: { email: 'admin@mediagenda.co.mz', password: 'errada' }
  });
  assert.equal(status, 401);
  assert.equal(dados.codigo, 'NAO_AUTENTICADO');
  assert.match(dados.erro, /incorretos/i);
});

test('rotas protegidas devolvem 401 sem Bearer e 403 com perfil errado', async () => {
  const semToken = await pedir('/api/admin/resumo');
  assert.equal(semToken.status, 401);

  const paciente = await entrar('maria@example.com', 'Paciente@123');
  const pacienteTentou = await pedir('/api/admin/resumo', { token: paciente });
  assert.equal(pacienteTentou.status, 403);
  assert.equal(pacienteTentou.dados.codigo, 'PROIBIDO');

  const admin = await entrar('admin@mediagenda.co.mz', 'Admin@123');
  const adminPediu = await pedir('/api/admin/resumo', { token: admin });
  assert.equal(adminPediu.status, 200);
  assert.equal(adminPediu.dados.total, 15);
});

test('registo cria conta, confirma e-mail e permite login', async () => {
  const email = `novo-${Date.now()}@example.com`;
  const registo = await pedir('/api/auth/registo', {
    metodo: 'POST',
    corpo: { nome: 'Novo Paciente', email, password: 'Segredo@123' }
  });
  assert.equal(registo.status, 201);
  assert.equal(registo.dados.utilizador.perfil, 'paciente');
  assert.ok(registo.dados.tokenConfirmacao);

  const confirmacao = await pedir('/api/auth/confirmar-email', {
    metodo: 'POST',
    corpo: { token: registo.dados.tokenConfirmacao }
  });
  assert.equal(confirmacao.status, 200);

  const token = await entrar(email, 'Segredo@123');
  const me = await pedir('/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.dados.utilizador.nome, 'Novo Paciente');
  assert.ok(me.dados.paciente, 'perfil de paciente criado');
});

test('endpoint público de médicos e disponibilidade devolve slots', async () => {
  const lista = await pedir('/api/medicos?especialidade=Ortopedia');
  assert.equal(lista.status, 200);
  assert.ok(lista.dados.length >= 1);
  assert.ok(lista.dados.every((m) => m.especialidades.some((e) => e.nome === 'Ortopedia')));

  const dia = proximoDiaUtil(3);
  const data = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
  const disponibilidade = await pedir(`/api/medicos/${lista.dados[0].id}/disponibilidade?data=${data}`);
  assert.equal(disponibilidade.status, 200);
  assert.equal(disponibilidade.dados.data, data);
  assert.ok(Array.isArray(disponibilidade.dados.slots));
  assert.ok(disponibilidade.dados.slots.some((s) => s.hora));
});

test('notificações do paciente estão disponíveis e podem ser marcadas como lidas', async () => {
  const token = await entrar('maria@example.com', 'Paciente@123');
  const { status, dados } = await pedir('/api/notificacoes', { token });
  assert.equal(status, 200);
  assert.ok(dados.notificacoes.length >= 3);
  assert.ok(dados.naoLidas >= 1);

  const primeira = dados.notificacoes.find((n) => !n.lida_em) || dados.notificacoes[0];
  const marcada = await pedir(`/api/notificacoes/${primeira.id}/lida`, {
    metodo: 'PATCH',
    token
  });
  assert.equal(marcada.status, 200);

  const depois = await pedir('/api/notificacoes', { token });
  assert.ok(depois.dados.notificacoes.find((n) => n.id === primeira.id).lida_em);
});

test('demo/arquitetura é exclusivo do admin e expõe os 10 padrões e a telemetria', async () => {
  const paciente = await entrar('maria@example.com', 'Paciente@123');
  assert.equal((await pedir('/api/demo/arquitetura', { token: paciente })).status, 403);

  const admin = await entrar('admin@mediagenda.co.mz', 'Admin@123');
  const { status, dados } = await pedir('/api/demo/arquitetura', { token: admin });
  assert.equal(status, 200);
  assert.equal(dados.padroes.length, 10);
  assert.equal(dados.resumoEventos.total, 6);
  assert.ok(dados.padroes.some((p) => /Chain of Responsibility/.test(p.nome)));
  assert.ok(dados.configuracoes.length >= 10);
});

test('simulador devolve os passos da cadeia e persiste o trace', async () => {
  const admin = await entrar('admin@mediagenda.co.mz', 'Admin@123');
  const medicos = await pedir('/api/medicos?nome=Joaquim');
  const medico = medicos.dados[0];
  const paciente = (await pedir('/api/pacientes', { token: admin })).dados
    .find((p) => p.email === 'maria@example.com');

  const { status, dados } = await pedir('/api/demo/simular', {
    metodo: 'POST',
    token: admin,
    corpo: {
      pacienteId: paciente.id,
      medicoId: medico.id,
      especialidadeId: medico.especialidades[0].id,
      dataHora: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    }
  });

  assert.equal(status, 200);
  assert.equal(dados.aprovado, false);
  assert.equal(dados.falhouEm, 'RN-01');
  assert.equal(dados.passos.length, 1);
  assert.ok(dados.traceId);
  assert.ok(ctx.repositorios.traces.porId(dados.traceId));
});

test('exportação CSV exige admin, usa BOM e separador ponto e vírgula', async () => {
  const paciente = await entrar('maria@example.com', 'Paciente@123');
  assert.equal((await pedir('/api/admin/relatorios/export.csv', { token: paciente })).status, 403);

  const admin = await entrar('admin@mediagenda.co.mz', 'Admin@123');
  const resposta = await fetch(`${base}/api/admin/relatorios/export.csv`, {
    headers: { authorization: `Bearer ${admin}` }
  });
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get('content-type'), /text\/csv/);
  assert.match(resposta.headers.get('content-disposition'), /mediagenda-relatorio\.csv/);

  const bytes = Buffer.from(await resposta.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 para o Excel');
  const linhas = bytes.toString('utf8').replace(/^\uFEFF/, '').split('\r\n');
  assert.match(linhas[0], /^"ID";"Data";"Hora"/);
  assert.equal(linhas.length, 16);
});

test('endpoint inexistente devolve 404 em JSON', async () => {
  const { status, dados } = await pedir('/api/nao-existe');
  assert.equal(status, 404);
  assert.equal(dados.codigo, 'ENDPOINT_NAO_ENCONTRADO');
});
