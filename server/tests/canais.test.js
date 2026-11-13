/**
 * Testes do canal WhatsApp (melhoria do link ChatGPT):
 * - ISP: IEnviadorWhatsApp é uma interface pequena e independente;
 * - Adapter: AdapterWhatsApp escreve no outbox sem rede;
 * - Factory Method: criar('whatsapp') devolve a classe concreta;
 * - Strategy: preferência 'whatsapp' escolhe o canal certo;
 * - NotificacaoService: sem telefone, o canal WhatsApp é descartado.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repor, fechar, outboxTeste } from './helpers.js';

const { AdapterWhatsApp, IEnviadorWhatsApp } = await import('../src/domain/notificacao/canais.js');
const { NotificacaoFactory } = await import('../src/domain/notificacao/factory.js');
const { obterEstrategiaNotificacao } = await import('../src/domain/notificacao/estrategias.js');
const { notificacaoService, repositorios } = await import('../src/container.js');
const { db } = await import('../src/db/index.js');

before(async () => { await repor(); });
after(async () => { await fechar(); });

test('AdapterWhatsApp escreve a mensagem no outbox/whatsapp', async () => {
  const adapter = new AdapterWhatsApp();
  const r = await adapter.enviarWhatsApp({
    para: '+258840000001',
    mensagem: 'Lembrete: consulta amanhã'
  });
  assert.equal(r.provedor, 'WhatsApp Business simulado');
  assert.ok(fs.existsSync(r.ficheiro));
  const conteudo = fs.readFileSync(r.ficheiro, 'utf8');
  assert.ok(conteudo.includes('+258840000001'));
  assert.ok(conteudo.includes('Lembrete: consulta amanhã'));
  assert.ok(r.ficheiro.startsWith(path.join(outboxTeste, 'whatsapp')));
});

test('IEnviadorWhatsApp lança erro se não for implementado (ISP)', async () => {
  await assert.rejects(() => new IEnviadorWhatsApp().enviarWhatsApp({}), /não implementado/);
});

test('NotificacaoFactory devolve WhatsAppNotificacao para "whatsapp"', async () => {
  const factory = new NotificacaoFactory({
    emailAdapter: {},
    smsAdapter: {},
    whatsappAdapter: new AdapterWhatsApp()
  });
  const n = factory.criar('whatsapp');
  assert.equal(n.canal, 'whatsapp');
  const r = await n.enviar({ para: '+258840000002', assunto: 'Assunto', corpo: 'Corpo' });
  assert.ok(fs.existsSync(r.ficheiro));
});

test('Factory sem whatsappAdapter configurado recusa o canal', () => {
  const factory = new NotificacaoFactory({ emailAdapter: {}, smsAdapter: {} });
  assert.throws(() => factory.criar('whatsapp'), /não configurado/);
});

test('Strategy: preferência "whatsapp" devolve o canal whatsapp', () => {
  const estrategia = obterEstrategiaNotificacao('whatsapp');
  assert.equal(estrategia.nome, 'whatsapp');
  assert.deepEqual(estrategia.canais(), ['whatsapp']);
});

test('NotificacaoService usa o canal WhatsApp quando a preferência é whatsapp e há telefone', async () => {
  const u = repositorios.utilizadores.porEmail('maria@example.com');
  const enviadas = await notificacaoService.enviarPara(
    { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone || '+258840000003', preferencia: 'whatsapp' },
    { consultaId: null, evento: 'ConsultaCriada', assunto: 'Teste WhatsApp', corpo: 'Corpo do teste' }
  );
  assert.ok(enviadas.length >= 1);
  assert.ok(enviadas.every((n) => n.canal === 'whatsapp'));
  assert.ok(enviadas.every((n) => n.estado === 'enviada'));
  const registo = db.prepare('SELECT * FROM notificacoes WHERE id = ?').get(enviadas[0].id);
  assert.equal(registo.canal, 'whatsapp');
  assert.equal(registo.evento, 'ConsultaCriada');
});

test('NotificacaoService descarta WhatsApp (e usa e-mail) quando não há telefone', async () => {
  const u = repositorios.utilizadores.porEmail('maria@example.com');
  const enviadas = await notificacaoService.enviarPara(
    { id: u.id, nome: u.nome, email: u.email, telefone: null, preferencia: 'whatsapp' },
    { consultaId: null, evento: 'ConsultaCriada', assunto: 'Sem telefone', corpo: 'Corpo' }
  );
  assert.ok(enviadas.length >= 1);
  assert.ok(enviadas.every((n) => n.canal === 'email'));
});
