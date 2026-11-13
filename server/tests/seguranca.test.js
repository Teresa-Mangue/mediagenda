/**
 * Testes unitários de segurança: hashing de palavras-passe com scrypt e
 * tokens HMAC assinados (sem dependências externas).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  hashPassword, verificarPassword, criarToken, verificarToken, tokenAleatorio
} from '../src/utils/security.js';

test('hashPassword usa salt aleatório e nunca guarda a palavra-passe em claro', () => {
  const primeiro = hashPassword('Paciente@123');
  const segundo = hashPassword('Paciente@123');
  assert.notEqual(primeiro, segundo);
  assert.equal(primeiro.includes('Paciente@123'), false);
  assert.match(primeiro, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test('verificarPassword aceita a palavra-passe correcta e recusa as restantes', () => {
  const hash = hashPassword('Medico@123');
  assert.equal(verificarPassword('Medico@123', hash), true);
  assert.equal(verificarPassword('medico@123', hash), false);
  assert.equal(verificarPassword('', hash), false);
  assert.equal(verificarPassword('Medico@123', null), false);
  assert.equal(verificarPassword('Medico@123', 'formato-invalido'), false);
});

test('criarToken/verificarToken preservam o payload', () => {
  const token = criarToken({ sub: 7, nome: 'Maria', perfil: 'paciente', medicoId: null, pacienteId: 3 });
  const dados = verificarToken(token);
  assert.equal(dados.sub, 7);
  assert.equal(dados.nome, 'Maria');
  assert.equal(dados.perfil, 'paciente');
  assert.equal(dados.pacienteId, 3);
  assert.ok(dados.exp > Date.now());
});

test('verificarToken recusa tokens adulterados, vazios ou malformados', () => {
  const token = criarToken({ sub: 1, perfil: 'admin' });
  const [corpo] = token.split('.');
  assert.equal(verificarToken(`${corpo}.assinatura-falsa`), null);
  assert.equal(verificarToken('),'), null);
  assert.equal(verificarToken(null), null);
  assert.equal(verificarToken(''), null);
});

test('verificarToken recusa tokens expirados', () => {
  // Reproduz o formato do token com uma expiração no passado.
  const segredo = process.env.MEDIAGENDA_SECRET || 'mediagenda-ispt-2026-segredo-local';
  const payload = Buffer.from(JSON.stringify({ sub: 1, exp: Date.now() - 1000 })).toString('base64url');
  const assinatura = crypto.createHmac('sha256', segredo).update(payload).digest('base64url');
  assert.equal(verificarToken(`${payload}.${assinatura}`), null);
});

test('tokenAleatorio gera valores distintos e suficientemente longos', () => {
  const a = tokenAleatorio();
  const b = tokenAleatorio();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{48}$/);
});
