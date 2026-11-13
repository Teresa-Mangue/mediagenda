/**
 * Testes unitários do padrão State (RN-02 e RN-07).
 * Não precisam de base de dados: as classes de estado são puras.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarEstado, EstadoPendente, EstadoConfirmada, EstadoRealizada, EstadoCancelada,
  TODOS_OS_ESTADOS
} from '../src/domain/consulta/estados.js';

const consulta = (dataHora, prazoConfirmacao = new Date(Date.now() + 60 * 60 * 1000).toISOString()) => ({
  id: 1,
  estado: 'pendente',
  data_hora: new Date(dataHora).toISOString(),
  prazo_confirmacao: prazoConfirmacao
});

test('cada estado expõe as transições válidas do diagrama', () => {
  assert.deepEqual(criarEstado('pendente').transicoes, ['confirmada', 'cancelada']);
  assert.deepEqual(criarEstado('confirmada').transicoes, ['cancelada', 'realizada']);
  assert.deepEqual(criarEstado('realizada').transicoes, []);
  assert.deepEqual(criarEstado('cancelada').transicoes, []);
  assert.deepEqual(TODOS_OS_ESTADOS, ['pendente', 'confirmada', 'realizada', 'cancelada']);
});

test('criarEstado devolve a classe concreta correcta', () => {
  assert.ok(criarEstado('pendente') instanceof EstadoPendente);
  assert.ok(criarEstado('confirmada') instanceof EstadoConfirmada);
  assert.ok(criarEstado('realizada') instanceof EstadoRealizada);
  assert.ok(criarEstado('cancelada') instanceof EstadoCancelada);
});

test('criarEstado rejeita estados desconhecidos', () => {
  assert.throws(() => criarEstado('arquivada'), (erro) => erro.status === 500);
});

test('RN-07: confirmação dentro do prazo é aceite', () => {
  const transicao = new EstadoPendente().confirmar(consulta(Date.now() + 24 * 3600 * 1000));
  assert.equal(transicao.estado, 'confirmada');
  assert.ok(transicao.confirmada_em);
});

test('RN-07: confirmação fora do prazo é recusada', () => {
  const expirada = consulta(Date.now() + 24 * 3600 * 1000, new Date(Date.now() - 1000).toISOString());
  assert.throws(
    () => new EstadoPendente().confirmar(expirada),
    (erro) => erro.codigo === 'PRAZO_CONFIRMACAO_EXPIRADO' && erro.status === 409
  );
});

test('RN-02: cancelar com menos de 24h é tardio', () => {
  const transicao = new EstadoConfirmada().cancelar(consulta(Date.now() + 2 * 3600 * 1000), {
    motivo: 'Imprevisto'
  });
  assert.equal(transicao.estado, 'cancelada');
  assert.equal(transicao.cancelamento_tardio, 1);
  assert.match(transicao.motivo, /tardio/i);
});

test('RN-02: cancelar com pelo menos 24h não é tardio', () => {
  const transicao = new EstadoPendente().cancelar(consulta(Date.now() + 72 * 3600 * 1000), {
    motivo: 'Férias'
  });
  assert.equal(transicao.cancelamento_tardio, 0);
  assert.match(transicao.motivo, /antecedência/i);
});

test('realizar só é válido a partir de confirmada', () => {
  assert.equal(new EstadoConfirmada().realizar().estado, 'realizada');
  assert.throws(() => new EstadoPendente().realizar(), (erro) => erro.codigo === 'TRANSICAO_INVALIDA');
  assert.throws(() => new EstadoRealizada().realizar(), (erro) => erro.codigo === 'TRANSICAO_INVALIDA');
  assert.throws(() => new EstadoCancelada().cancelar(consulta(Date.now() + 3600 * 1000)),
    (erro) => erro.codigo === 'TRANSICAO_INVALIDA');
  assert.throws(() => new EstadoRealizada().confirmar(consulta(Date.now() + 3600 * 1000)),
    (erro) => erro.codigo === 'TRANSICAO_INVALIDA');
});
