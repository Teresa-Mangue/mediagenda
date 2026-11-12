import { db, nowIso } from './index.js';
import { hashPassword } from '../utils/security.js';
import { adicionarMinutos, adicionarHoras, chaveData, combinarDataHora } from '../utils/tempo.js';
import { PADROES } from '../config/ConfiguracaoSistema.js';

export function baseVazia() {
  const tabelas = [
    'evento_consumos', 'eventos', 'validacoes_traces', 'notificacoes', 'auditoria',
    'consulta_historico', 'avaliacoes', 'consultas', 'bloqueios', 'disponibilidades',
    'medico_especialidades', 'medicos', 'pacientes', 'users', 'especialidades', 'configuracoes'
  ];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const tabela of tabelas) db.exec(`DELETE FROM ${tabela};`);
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('evento_consumos','eventos','validacoes_traces','notificacoes','auditoria','consulta_historico','avaliacoes','consultas','bloqueios','disponibilidades','medicos','pacientes','users','especialidades');");
  db.exec('PRAGMA foreign_keys = ON;');
}

export function seed({ reset = false } = {}) {
  const existentes = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (existentes > 0 && !reset) return { criado: false, mensagem: 'Base de dados já contém dados.' };
  if (reset) baseVazia();

  const agora = nowIso();

  for (const [chave, valor] of Object.entries(PADROES)) {
    db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run(chave, valor);
  }
  db.prepare("UPDATE configuracoes SET descricao = 'Nome apresentado na aplicação' WHERE chave = 'nome_clinica'").run();

  const criarUtilizador = (nome, email, password, perfil, telefone, preferencia = 'email') => {
    const r = db.prepare(`
      INSERT INTO users (nome, email, password_hash, perfil, telefone, ativo, email_confirmado,
                         preferencia_notificacao, criado_em)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
    `).run(nome, email, hashPassword(password), perfil, telefone, preferencia, agora);
    return Number(r.lastInsertRowid);
  };

  // --- Especialidades -------------------------------------------------------
  const especialidades = {};
  const criarEspecialidade = (nome, descricao, duracao) => {
    const r = db.prepare('INSERT INTO especialidades (nome, descricao, duracao_padrao_min) VALUES (?, ?, ?)')
      .run(nome, descricao, duracao);
    especialidades[nome] = Number(r.lastInsertRowid);
  };
  criarEspecialidade('Cardiologia', 'Doenças do coração e sistema cardiovascular', 60);
  criarEspecialidade('Pediatria', 'Saúde de crianças e adolescentes', 60);
  criarEspecialidade('Ortopedia', 'Sistema músculo-esquelético', 90);
  criarEspecialidade('Dermatologia', 'Pele, cabelo e unhas', 60);
  criarEspecialidade('Clínica Geral', 'Atendimento geral e encaminhamento', 60);
  criarEspecialidade('Fisioterapia', 'Reabilitação física e motora', 120);

  // --- Administração --------------------------------------------------------
  const adminId = criarUtilizador('Administrador MediAgenda', 'admin@mediagenda.co.mz', 'Admin@123', 'admin', '+258 84 000 0001');
  criarUtilizador('Sara Secretária', 'secretaria@mediagenda.co.mz', 'Secretaria@123', 'secretario', '+258 84 000 0002');

  // --- Pacientes ------------------------------------------------------------
  const criarPaciente = (nome, email, telefone, nascimento, endereco, preferencia = 'email') => {
    const userId = criarUtilizador(nome, email, 'Paciente@123', 'paciente', telefone, preferencia);
    const r = db.prepare('INSERT INTO pacientes (utilizador_id, data_nascimento, endereco, criado_em) VALUES (?, ?, ?, ?)')
      .run(userId, nascimento, endereco, agora);
    return Number(r.lastInsertRowid);
  };
  const mariaId = criarPaciente('Maria Silva', 'maria@example.com', '+258 84 111 1111', '1994-04-12', 'Bairro de Matundo, Tete', 'email');
  const carlosId = criarPaciente('Carlos Mabote', 'carlos@example.com', '+258 84 222 2222', '1987-09-03', 'Bairro Josina Machel, Tete', 'sms');
  const anaId = criarPaciente('Ana Chissano', 'ana@example.com', '+258 84 333 3333', '2001-01-22', 'Bairro Chingodzi, Tete', 'ambos');

  // --- Médicos --------------------------------------------------------------
  const criarMedico = (nome, email, registo, localizacao, especialidadesNomes, duracao = 60, bio = '', fimTarde = '18:00') => {
    const userId = criarUtilizador(nome, email, 'Medico@123', 'medico', '+258 84 555 0000', 'email');
    const r = db.prepare(`
      INSERT INTO medicos (utilizador_id, numero_registo, localizacao, biografia, duracao_consulta_min, max_consultas_dia, ativo, criado_em)
      VALUES (?, ?, ?, ?, ?, 10, 1, ?)
    `).run(userId, registo, localizacao, bio, duracao, agora);
    const medicoId = Number(r.lastInsertRowid);
    for (const nomeEspecialidade of especialidadesNomes) {
      db.prepare('INSERT INTO medico_especialidades (medico_id, especialidade_id) VALUES (?, ?)')
        .run(medicoId, especialidades[nomeEspecialidade]);
    }
    for (const dia of [1, 2, 3, 4, 5]) {
      db.prepare('INSERT INTO disponibilidades (medico_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)')
        .run(medicoId, dia, '08:00', '12:00');
      db.prepare('INSERT INTO disponibilidades (medico_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)')
        .run(medicoId, dia, '14:00', fimTarde);
    }
    return medicoId;
  };

  const antonioId = criarMedico('Dr. António Nhampossa', 'antonio@mediagenda.co.mz', 'OM-1024', 'Clínica MediAgenda — Tete', ['Cardiologia', 'Clínica Geral'], 60,
    'Cardiologista com 12 anos de experiência em Tete.', '20:00');
  const anaMedicaId = criarMedico('Dra. Ana Lopes', 'ana.medica@mediagenda.co.mz', 'OM-2048', 'Clínica MediAgenda — Tete', ['Pediatria'], 60,
    'Pediatra dedicada ao acompanhamento infantil.');
  const joaquimId = criarMedico('Dr. Joaquim Ferraz', 'joaquim@mediagenda.co.mz', 'OM-3072', 'Clínica MediAgenda — Matundo', ['Ortopedia'], 90,
    'Ortopedista, especialista em reabilitação.');
  const luciaId = criarMedico('Dra. Lúcia Muianga', 'lucia@mediagenda.co.mz', 'OM-4096', 'Clínica MediAgenda — Tete', ['Dermatologia', 'Fisioterapia'], 60,
    'Dermatologista e fisioterapeuta.');

  // --- Consultas de demonstração -------------------------------------------
  const inserirConsulta = ({
    pacienteId, medicoId, especialidadeId, dataHora, duracao = 60, estado = 'confirmada',
    motivoCancelamento = null, tardio = 0, confirmadaEm = null, prazoHoras = 2
  }) => {
    const criadaEm = estado === 'pendente' ? agora : adicionarMinutos(dataHora, -24 * 60).toISOString();
    const prazo = estado === 'pendente' ? adicionarHoras(agora, prazoHoras).toISOString() : adicionarHoras(criadaEm, prazoHoras).toISOString();
    const r = db.prepare(`
      INSERT INTO consultas (paciente_id, medico_id, especialidade_id, data_hora, duracao_min, estado,
        motivo_cancelamento, cancelamento_tardio, confirmada_em, prazo_confirmacao, criada_em, atualizada_em, criada_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(pacienteId, medicoId, especialidadeId, dataHora.toISOString(), duracao, estado,
      motivoCancelamento, tardio, confirmadaEm, prazo, criadaEm, agora, adminId);
    const id = Number(r.lastInsertRowid);
    db.prepare(`
      INSERT INTO consulta_historico (consulta_id, estado_anterior, estado_novo, motivo, autor_id, criado_em)
      VALUES (?, NULL, 'pendente', 'Consulta criada (dados de demonstração)', ?, ?)
    `).run(id, adminId, criadaEm);
    if (estado !== 'pendente') {
      db.prepare(`
        INSERT INTO consulta_historico (consulta_id, estado_anterior, estado_novo, motivo, autor_id, criado_em)
        VALUES (?, 'pendente', ?, 'Transição de demonstração', ?, ?)
      `).run(id, estado, adminId, agora);
    }
    return id;
  };

  const hoje = new Date();
  const emDias = (dias, hora) => combinarDataHora(chaveData(adicionarMinutos(hoje, dias * 24 * 60)), hora);

  // Passadas / realizadas
  const c1 = inserirConsulta({
    pacienteId: mariaId, medicoId: antonioId, especialidadeId: especialidades.Cardiologia,
    dataHora: emDias(-7, '09:00'), estado: 'realizada'
  });
  inserirConsulta({
    pacienteId: carlosId, medicoId: joaquimId, especialidadeId: especialidades.Ortopedia,
    dataHora: emDias(-14, '10:30'), duracao: 90, estado: 'realizada'
  });
  const c3 = inserirConsulta({
    pacienteId: anaId, medicoId: anaMedicaId, especialidadeId: especialidades.Pediatria,
    dataHora: emDias(-3, '15:00'), estado: 'cancelada', motivoCancelamento: 'Imprevisto familiar', tardio: 0
  });

  // Futuras
  const amanha = emDias(1, '10:00');
  const cFutura = inserirConsulta({
    pacienteId: mariaId, medicoId: antonioId, especialidadeId: especialidades.Cardiologia,
    dataHora: amanha, estado: 'confirmada', confirmadaEm: agora
  });
  inserirConsulta({
    pacienteId: carlosId, medicoId: luciaId, especialidadeId: especialidades.Dermatologia,
    dataHora: emDias(2, '16:00'), estado: 'confirmada', confirmadaEm: agora
  });
  const cPendente = inserirConsulta({
    pacienteId: anaId, medicoId: anaMedicaId, especialidadeId: especialidades.Pediatria,
    dataHora: emDias(3, '09:00'), estado: 'pendente', prazoHoras: 2
  });
  inserirConsulta({
    pacienteId: carlosId, medicoId: joaquimId, especialidadeId: especialidades.Ortopedia,
    dataHora: emDias(4, '14:00'), duracao: 90, estado: 'confirmada', confirmadaEm: agora
  });

  // Dia cheio do Dr. António (para demonstrar RN-03 no Architecture Lab)
  const horasCheias = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  for (let i = 0; i < horasCheias.length; i++) {
    inserirConsulta({
      pacienteId: [mariaId, carlosId, anaId][i % 3],
      medicoId: antonioId,
      especialidadeId: especialidades.Cardiologia,
      dataHora: emDias(5, horasCheias[i]),
      estado: 'confirmada',
      confirmadaEm: agora
    });
  }

  // Avaliações
  db.prepare('INSERT INTO avaliacoes (consulta_id, pontuacao, comentario, criado_em) VALUES (?, ?, ?, ?)')
    .run(c1, 5, 'Atendimento excelente, muito atencioso.', agora);

  // Bloqueio de demonstração
  db.prepare('INSERT INTO bloqueios (medico_id, inicio, fim, motivo, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(luciaId, emDias(6, '08:00').toISOString(), emDias(6, '18:00').toISOString(), 'Formação externa', agora);

  // Auditoria inicial
  const auditar = (acao, entidade, detalhes) => db.prepare(`
    INSERT INTO auditoria (utilizador_id, acao, entidade, entidade_id, detalhes, ip, criado_em)
    VALUES (?, ?, ?, NULL, ?, '127.0.0.1', ?)
  `).run(adminId, acao, entidade, JSON.stringify(detalhes), agora);
  auditar('SISTEMA_INICIALIZADO', 'sistema', { versao: '1.0.0', origem: 'seed' });

  return {
    criado: true,
    resumo: {
      utilizadores: 3 + 3 + 4,
      pacientes: 3,
      medicos: 4,
      especialidades: 6,
      consultas: 5 + 10 + 1
    },
    credenciais: {
      admin: 'admin@mediagenda.co.mz / Admin@123',
      secretaria: 'secretaria@mediagenda.co.mz / Secretaria@123',
      medico: 'antonio@mediagenda.co.mz / Medico@123',
      paciente: 'maria@example.com / Paciente@123'
    },
    consultasDemo: { realizada: c1, cancelada: c3, futura: cFutura, pendente: cPendente }
  };
}

const executadoDirectamente = process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('db/seed.js');
if (executadoDirectamente) {
  const reset = process.argv.includes('--reset');
  const resultado = seed({ reset });
  console.log(JSON.stringify(resultado, null, 2));
}
