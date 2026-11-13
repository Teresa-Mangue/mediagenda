/**
 * Infra-estrutura partilhada pelos testes.
 *
 * Cada ficheiro de teste corre num processo próprio, logo recebe a sua
 * própria base de dados temporária. O ambiente é definido ANTES de
 * importar qualquer módulo do servidor, porque `server/src/db/index.js`
 * lê `MEDIAGENDA_DB` no momento da importação.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const sufixo = crypto.randomUUID();

export const dbFicheiro = path.join(os.tmpdir(), `mediagenda-test-${sufixo}.db`);
export const outboxTeste = path.join(os.tmpdir(), `mediagenda-outbox-${sufixo}`);

process.env.MEDIAGENDA_DB = dbFicheiro;
process.env.MEDIAGENDA_SECRET = 'segredo-de-teste-mediagenda';
process.env.MEDIAGENDA_OUTBOX = outboxTeste;

let modulos = null;

/** Importa e memoriza todos os módulos do servidor. */
export async function carregar() {
  if (modulos) return modulos;
  const seedModule = await import('../src/db/seed.js');
  const container = await import('../src/container.js');
  const appModule = await import('../src/api/app.js');
  modulos = { ...seedModule, ...container, ...appModule };
  return modulos;
}

/** Repõe os dados de demonstração e devolve todos os módulos. */
export async function repor() {
  const m = await carregar();
  const resultado = m.seed({ reset: true });
  m.servicos.configuracao.invalidar();
  return { ...m, resultado };
}

/** Fecha a base de dados e remove os ficheiros temporários. */
export async function fechar() {
  const m = await carregar();
  try { m.db?.close?.(); } catch { /* já fechada */ }
  const { db } = await import('../src/db/index.js');
  try { db.close(); } catch { /* já fechada */ }
  for (const ficheiro of [dbFicheiro, `${dbFicheiro}-wal`, `${dbFicheiro}-shm`]) {
    try { fs.unlinkSync(ficheiro); } catch { /* inexistente */ }
  }
  try { fs.rmSync(outboxTeste, { recursive: true, force: true }); } catch { /* inexistente */ }
}

/**
 * Próximo dia útil (segunda a sexta) a `offsetDias` de hoje, com a hora
 * indicada. Usado para construir marcações válidas e determinísticas.
 */
export function proximoDiaUtil(offsetDias = 1, hora = '10:00') {
  const data = new Date();
  data.setDate(data.getDate() + offsetDias);
  data.setHours(0, 0, 0, 0);
  while (data.getDay() === 0 || data.getDay() === 6) data.setDate(data.getDate() + 1);
  const [h, m] = String(hora).split(':').map(Number);
  data.setHours(h, m, 0, 0);
  return data;
}

/** Utilizador no formato que o middleware `autenticar` injeta em `req`. */
export async function utilizadorPorEmail(email) {
  const m = await carregar();
  const u = m.repositorios.utilizadores.porEmail(email);
  if (!u) throw new Error(`Utilizador de teste inexistente: ${email}`);
  const medico = u.perfil === 'medico' ? m.repositorios.medicos.porUtilizador(u.id) : null;
  const paciente = u.perfil === 'paciente' ? m.repositorios.pacientes.porUtilizador(u.id) : null;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    medicoId: medico?.id ?? null,
    pacienteId: paciente?.id ?? null
  };
}

export async function medicoPorEmail(email) {
  const m = await carregar();
  const u = m.repositorios.utilizadores.porEmail(email);
  const medico = m.repositorios.medicos.porUtilizador(u.id);
  return medico ? m.repositorios.medicos.porId(medico.id) : null;
}

export async function pacientePorEmail(email) {
  const m = await carregar();
  const u = m.repositorios.utilizadores.porEmail(email);
  return m.repositorios.pacientes.porUtilizador(u.id);
}

/** Cria uma consulta directamente no repositório (sem passar pela cadeia). */
export async function criarConsulta({
  pacienteEmail, medicoEmail, especialidade, dataHora, duracaoMin, estado = 'confirmada',
  prazoConfirmacao
}) {
  const m = await carregar();
  const paciente = await pacientePorEmail(pacienteEmail);
  const medico = await medicoPorEmail(medicoEmail);
  const esp = medico.especialidades.find((e) => e.nome === especialidade) || medico.especialidades[0];
  return m.repositorios.consultas.criar({
    pacienteId: paciente.id,
    medicoId: medico.id,
    especialidadeId: esp.id,
    dataHora: new Date(dataHora).toISOString(),
    duracaoMin: duracaoMin ?? esp.duracao_padrao_min,
    estado,
    prazoConfirmacao: prazoConfirmacao ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  });
}
