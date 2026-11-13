import { db } from '../db/index.js';
import { formatarDataHora, formatarData } from '../utils/tempo.js';

export class RelatorioService {
  #versao = 0;

  /** Consumidor de eventos: invalida a cache de relatórios. */
  invalidarCache() {
    this.#versao += 1;
    return { versao: this.#versao, invalidadaEm: new Date().toISOString() };
  }

  resumo() {
    const porEstado = db.prepare(`
      SELECT estado, COUNT(*) AS total FROM consultas GROUP BY estado
    `).all();
    const estados = Object.fromEntries(porEstado.map((e) => [e.estado, Number(e.total)]));
    const total = porEstado.reduce((soma, e) => soma + Number(e.total), 0);

    const porEspecialidade = db.prepare(`
      SELECT e.nome AS especialidade,
             COUNT(c.id) AS total,
             SUM(CASE WHEN c.estado = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
             SUM(CASE WHEN c.estado = 'realizada' THEN 1 ELSE 0 END) AS realizadas
      FROM especialidades e
      LEFT JOIN consultas c ON c.especialidade_id = e.id
      GROUP BY e.id ORDER BY total DESC
    `).all();

    const satisfacaoPorMedico = db.prepare(`
      SELECT m.id AS medico_id, u.nome AS medico,
             ROUND(AVG(a.pontuacao), 2) AS media,
             COUNT(a.id) AS avaliacoes
      FROM medicos m
      JOIN users u ON u.id = m.utilizador_id
      LEFT JOIN consultas c ON c.medico_id = m.id
      LEFT JOIN avaliacoes a ON a.consulta_id = c.id
      GROUP BY m.id HAVING avaliacoes > 0
      ORDER BY media DESC
    `).all();

    const ocupacao = db.prepare(`
      SELECT c.medico_id, date(c.data_hora) AS dia, COUNT(*) AS total, m.max_consultas_dia
      FROM consultas c JOIN medicos m ON m.id = c.medico_id
      WHERE c.estado IN ('pendente', 'confirmada', 'realizada')
      GROUP BY c.medico_id, dia
    `).all();
    const ocupacaoMedia = ocupacao.length
      ? Math.round(
        ocupacao.reduce((soma, o) => soma + Number(o.total) / Math.max(1, Number(o.max_consultas_dia)), 0)
        / ocupacao.length * 100
      )
      : 0;

    const porMes = db.prepare(`
      SELECT substr(data_hora, 1, 7) AS mes, COUNT(*) AS total
      FROM consultas GROUP BY mes ORDER BY mes DESC LIMIT 6
    `).all().reverse();

    const proximas = db.prepare(`
      SELECT COUNT(*) AS total FROM consultas
      WHERE estado IN ('pendente', 'confirmada') AND data_hora >= ?
    `).get(new Date().toISOString()).total;

    return {
      total,
      confirmadas: estados.confirmada || 0,
      pendentes: estados.pendente || 0,
      realizadas: estados.realizada || 0,
      canceladas: estados.cancelada || 0,
      taxaCancelamento: total ? Math.round((estados.cancelada || 0) / total * 100) : 0,
      taxaRealizacao: total ? Math.round((estados.realizada || 0) / total * 100) : 0,
      ocupacaoMedia,
      porEspecialidade,
      satisfacaoPorMedico,
      porMes,
      proximas: Number(proximas),
      medicosAtivos: Number(db.prepare('SELECT COUNT(*) AS t FROM medicos WHERE ativo = 1').get().t),
      pacientesRegistados: Number(db.prepare("SELECT COUNT(*) AS t FROM pacientes p JOIN users u ON u.id = p.utilizador_id WHERE u.ativo = 1").get().t),
      cancelamentosTardios: Number(db.prepare('SELECT COUNT(*) AS t FROM consultas WHERE cancelamento_tardio = 1').get().t),
      aprovacoesPendentes: Number(db.prepare("SELECT COUNT(*) AS t FROM users WHERE estado_aprovacao = 'pendente'").get().t),
      cidades: Number(db.prepare("SELECT COUNT(DISTINCT localizacao) AS t FROM medicos WHERE ativo = 1 AND localizacao IS NOT NULL").get().t),
      versaoCache: this.#versao
    };
  }

  relatorioMedico(medicoId) {
    const medico = db.prepare(`
      SELECT m.id, u.nome, m.numero_registo, m.localizacao, m.max_consultas_dia
      FROM medicos m JOIN users u ON u.id = m.utilizador_id WHERE m.id = ?
    `).get(Number(medicoId));
    if (!medico) return null;

    const porEstado = db.prepare(`
      SELECT estado, COUNT(*) AS total FROM consultas
      WHERE medico_id = ? GROUP BY estado
    `).all(medicoId);
    const avaliacoes = db.prepare(`
      SELECT COUNT(*) AS total, ROUND(AVG(a.pontuacao), 2) AS media
      FROM avaliacoes a JOIN consultas c ON c.id = a.consulta_id
      WHERE c.medico_id = ?
    `).get(medicoId);

    return { medico, porEstado, avaliacoes };
  }

  listarConsultas({ desde, ate, estado }) {
    let sql = `
      SELECT c.id, c.data_hora, c.estado, c.duracao_min,
             up.nome AS paciente, um.nome AS medico, e.nome AS especialidade,
             c.cancelamento_tardio
      FROM consultas c
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN users up ON up.id = p.utilizador_id
      JOIN medicos m ON m.id = c.medico_id
      JOIN users um ON um.id = m.utilizador_id
      JOIN especialidades e ON e.id = c.especialidade_id
      WHERE 1 = 1
    `;
    const params = [];
    if (desde) { sql += ' AND c.data_hora >= ?'; params.push(desde); }
    if (ate) { sql += ' AND c.data_hora <= ?'; params.push(ate); }
    if (estado) { sql += ' AND c.estado = ?'; params.push(estado); }
    sql += ' ORDER BY c.data_hora DESC';
    return db.prepare(sql).all(...params);
  }

  exportarCsv(filtros = {}) {
    const linhas = this.listarConsultas(filtros);
    const cabecalho = ['ID', 'Data', 'Hora', 'Paciente', 'Médico', 'Especialidade', 'Estado', 'Duração (min)', 'Cancelamento tardio'];
    const corpo = linhas.map((l) => [
      l.id,
      formatarData(l.data_hora),
      formatarDataHora(l.data_hora).split(' ')[1] || '',
      l.paciente,
      l.medico,
      l.especialidade,
      l.estado,
      l.duracao_min,
      l.cancelamento_tardio ? 'Sim' : 'Não'
    ]);
    const escapar = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    return [cabecalho, ...corpo].map((linha) => linha.map(escapar).join(';')).join('\r\n');
  }
}
