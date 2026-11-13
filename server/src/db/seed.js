import { db, nowIso } from './index.js';
import { hashPassword } from '../utils/security.js';
import { adicionarMinutos, adicionarHoras, chaveData, combinarDataHora, formatarDataHora } from '../utils/tempo.js';
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

  const criarUtilizador = (nome, email, password, perfil, telefone, preferencia = 'email', opcoes = {}) => {
    const estado = opcoes.estadoAprovacao || 'aprovada';
    const activo = opcoes.ativo ?? (estado === 'aprovada' ? 1 : 0);
    const confirmado = opcoes.emailConfirmado ?? 1;
    const r = db.prepare(`
      INSERT INTO users (nome, email, password_hash, perfil, telefone, ativo, email_confirmado,
                         estado_aprovacao, aprovado_em, preferencia_notificacao, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nome, email, hashPassword(password), perfil, telefone, activo ? 1 : 0, confirmado ? 1 : 0,
      estado, estado === 'aprovada' ? agora : null, preferencia, agora
    );
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
  // A clínica está presente nas principais cidades de Moçambique. Cada médico
  // tem disponibilidade de segunda a sexta (08:00–12:00 e 14:00–fimTarde).
  const criarMedico = (
    nome, email, registo, localizacao, especialidadesNomes,
    duracao = 60, bio = '', fimTarde = '18:00', telefone = '+258 84 555 0000',
    opcoes = {}
  ) => {
    const userId = criarUtilizador(nome, email, 'Medico@123', 'medico', telefone, 'email', opcoes);
    const activo = opcoes.estadoAprovacao === 'pendente' ? 0 : 1;
    const r = db.prepare(`
      INSERT INTO medicos (utilizador_id, numero_registo, localizacao, biografia, duracao_consulta_min, max_consultas_dia, ativo, criado_em)
      VALUES (?, ?, ?, ?, ?, 10, ?, ?)
    `).run(userId, registo, localizacao, bio, duracao, activo, agora);
    const medicoId = Number(r.lastInsertRowid);
    for (const nomeEspecialidade of especialidadesNomes) {
      db.prepare('INSERT INTO medico_especialidades (medico_id, especialidade_id) VALUES (?, ?)')
        .run(medicoId, especialidades[nomeEspecialidade]);
    }
    if (activo) {
      for (const dia of [1, 2, 3, 4, 5]) {
        db.prepare('INSERT INTO disponibilidades (medico_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)')
          .run(medicoId, dia, '08:00', '12:00');
        db.prepare('INSERT INTO disponibilidades (medico_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)')
          .run(medicoId, dia, '14:00', fimTarde);
      }
    }
    return medicoId;
  };

  // Tete — os médicos usados pelas consultas de demonstração.
  const antonioId = criarMedico('Dr. António Nhampossa', 'antonio@mediagenda.co.mz', 'OM-1024', 'Clínica MediAgenda — Tete', ['Cardiologia', 'Clínica Geral'], 60,
    'Cardiologista com 12 anos de experiência em Tete.', '20:00', '+258 84 555 1024');
  const anaMedicaId = criarMedico('Dra. Ana Lopes', 'ana.medica@mediagenda.co.mz', 'OM-2048', 'Clínica MediAgenda — Tete', ['Pediatria'], 60,
    'Pediatra dedicada ao acompanhamento infantil.', '18:00', '+258 84 555 2048');
  const joaquimId = criarMedico('Dr. Joaquim Ferraz', 'joaquim@mediagenda.co.mz', 'OM-3072', 'Clínica MediAgenda — Matola', ['Ortopedia'], 90,
    'Ortopedista, especialista em reabilitação.', '18:00', '+258 84 555 3072');
  const luciaId = criarMedico('Dra. Lúcia Muianga', 'lucia@mediagenda.co.mz', 'OM-4096', 'Clínica MediAgenda — Tete', ['Dermatologia', 'Fisioterapia'], 60,
    'Dermatologista e fisioterapeuta.', '18:00', '+258 84 555 4096');

  // Rede nacional — duas especialidades por cidade principal.
  criarMedico('Dr. Nelson Macuácua', 'nelson@mediagenda.co.mz', 'OM-5120', 'Clínica MediAgenda — Maputo', ['Cardiologia', 'Clínica Geral'], 60,
    'Cardiologista de referência em Maputo.', '19:00', '+258 84 555 5120');
  criarMedico('Dra. Fátima Aly', 'fatima@mediagenda.co.mz', 'OM-6144', 'Clínica MediAgenda — Maputo', ['Dermatologia'], 60,
    'Dermatologista com prática clínica e estética.', '18:00', '+258 84 555 6144');
  criarMedico('Dr. Hélder Sitoe', 'helder@mediagenda.co.mz', 'OM-7168', 'Clínica MediAgenda — Beira', ['Ortopedia'], 90,
    'Ortopedista e traumatologista na Beira.', '18:00', '+258 84 555 7168');
  criarMedico('Dra. Rosália Nhantumbo', 'rosalia@mediagenda.co.mz', 'OM-8192', 'Clínica MediAgenda — Beira', ['Pediatria'], 60,
    'Pediatra com formação em neonatologia.', '18:00', '+258 84 555 8192');
  criarMedico('Dr. Américo Chale', 'americo@mediagenda.co.mz', 'OM-9216', 'Clínica MediAgenda — Nampula', ['Clínica Geral'], 60,
    'Clínico geral e referência de medicina familiar.', '18:00', '+258 84 555 9216');
  criarMedico('Dra. Isabel Mussa', 'isabel@mediagenda.co.mz', 'OM-10240', 'Clínica MediAgenda — Nampula', ['Fisioterapia'], 120,
    'Fisioterapeuta especializada em reabilitação motora.', '18:00', '+258 84 555 1024');
  criarMedico('Dr. Zacarias Muianga', 'zacarias@mediagenda.co.mz', 'OM-11264', 'Clínica MediAgenda — Quelimane', ['Cardiologia'], 60,
    'Cardiologista na Zambézia.', '18:00', '+258 84 555 1126');
  criarMedico('Dra. Celeste Bila', 'celeste@mediagenda.co.mz', 'OM-12288', 'Clínica MediAgenda — Quelimane', ['Dermatologia'], 60,
    'Dermatologista clínica.', '18:00', '+258 84 555 1228');
  criarMedico('Dr. Elias Mabjaia', 'elias@mediagenda.co.mz', 'OM-13312', 'Clínica MediAgenda — Chimoio', ['Ortopedia'], 90,
    'Ortopedista em Chimoio.', '18:00', '+258 84 555 1331');
  criarMedico('Dra. Noémia Guambe', 'noemia@mediagenda.co.mz', 'OM-14336', 'Clínica MediAgenda — Chimoio', ['Pediatria'], 60,
    'Pediatra e acompanhamento do crescimento.', '18:00', '+258 84 555 1433');
  criarMedico('Dr. Barnabé Ntumbo', 'barnabe@mediagenda.co.mz', 'OM-15360', 'Clínica MediAgenda — Pemba', ['Clínica Geral'], 60,
    'Clínico geral em Pemba.', '18:00', '+258 84 555 1536');
  criarMedico('Dra. Sónia Abudo', 'sonia@mediagenda.co.mz', 'OM-16384', 'Clínica MediAgenda — Pemba', ['Fisioterapia'], 120,
    'Fisioterapeuta com prática em reabilitação.', '18:00', '+258 84 555 1638');

  // Contas pendentes para demonstrar o fluxo de aprovação na defesa.
  criarMedico('Dr. Vasco Tembe', 'dr.pendente@mediagenda.co.mz', 'OM-17408', 'Clínica MediAgenda — Maputo', ['Cardiologia'], 60,
    'Candidato a cardiologista — cadastro por aprovar.', '18:00', '+258 84 555 1740',
    { estadoAprovacao: 'pendente', emailConfirmado: 0 });
  criarUtilizador('Telma Nhaca', 'secretaria.pendente@mediagenda.co.mz', 'Secretaria@123', 'secretario', '+258 84 555 1843', 'email',
    { estadoAprovacao: 'pendente', emailConfirmado: 0 });

  const utilizadorDePaciente = (pacienteId) =>
    db.prepare('SELECT utilizador_id FROM pacientes WHERE id = ?').get(pacienteId).utilizador_id;
  const mariaUtilizadorId = utilizadorDePaciente(mariaId);
  const anaUtilizadorId = utilizadorDePaciente(anaId);
  const antonioUtilizadorId = db.prepare('SELECT utilizador_id FROM medicos WHERE id = ?').get(antonioId).utilizador_id;

  // --- Consultas de demonstração -------------------------------------------
  const inserirConsulta = ({
    pacienteId, medicoId, especialidadeId, dataHora, duracao = 60, estado = 'confirmada',
    motivoCancelamento = null, tardio = 0, confirmadaEm = null, prazoHoras = 2,
    tokenConfirmacao = null
  }) => {
    const criadaEm = estado === 'pendente' ? agora : adicionarMinutos(dataHora, -24 * 60).toISOString();
    const prazo = estado === 'pendente' ? adicionarHoras(agora, prazoHoras).toISOString() : adicionarHoras(criadaEm, prazoHoras).toISOString();
    const r = db.prepare(`
      INSERT INTO consultas (paciente_id, medico_id, especialidade_id, data_hora, duracao_min, estado,
        motivo_cancelamento, cancelamento_tardio, confirmada_em, prazo_confirmacao, token_confirmacao,
        criada_em, atualizada_em, criada_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(pacienteId, medicoId, especialidadeId, dataHora.toISOString(), duracao, estado,
      motivoCancelamento, tardio, confirmadaEm, prazo, tokenConfirmacao, criadaEm, agora, adminId);
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
  // Dia útil a `dias` de distância, para cenários de demonstração (RN-03).
  const diaUtilFuturo = (dias) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + dias);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  };

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
    dataHora: emDias(3, '09:00'), estado: 'pendente', prazoHoras: 72,
    tokenConfirmacao: 'demo-consulta-pendente'
  });
  inserirConsulta({
    pacienteId: carlosId, medicoId: joaquimId, especialidadeId: especialidades.Ortopedia,
    dataHora: emDias(4, '14:00'), duracao: 90, estado: 'confirmada', confirmadaEm: agora
  });

  // Dia cheio do Dr. António (para demonstrar RN-03 no Architecture Lab).
  // O médico tem um limite diário de 8 consultas; 18:00 e 19:00 ficam livres,
  // mas a RN-03 recusa a marcação antes de se chegar ao conflito de agenda.
  db.prepare('UPDATE medicos SET max_consultas_dia = 8 WHERE id = ?').run(antonioId);
  const horasCheias = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
  const diaCheio = diaUtilFuturo(5);
  const diaCheioIds = [];
  for (let i = 0; i < horasCheias.length; i++) {
    diaCheioIds.push(inserirConsulta({
      pacienteId: [mariaId, carlosId, anaId][i % 3],
      medicoId: antonioId,
      especialidadeId: especialidades.Cardiologia,
      dataHora: combinarDataHora(chaveData(diaCheio), horasCheias[i]),
      estado: 'confirmada',
      confirmadaEm: agora
    }));
  }

  // Avaliações
  db.prepare('INSERT INTO avaliacoes (consulta_id, pontuacao, comentario, criado_em) VALUES (?, ?, ?, ?)')
    .run(c1, 5, 'Atendimento excelente, muito atencioso.', agora);

  // Bloqueio de demonstração
  db.prepare('INSERT INTO bloqueios (medico_id, inicio, fim, motivo, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(luciaId, emDias(6, '08:00').toISOString(), emDias(6, '18:00').toISOString(), 'Formação externa', agora);

  // -------------------------------------------------------------------------
  // Telemetria de demonstração: eventos (outbox), consumos, notificações e
  // traces da cadeia. Assim o Event Monitor e o X-Ray já têm conteúdo.
  // -------------------------------------------------------------------------
  const resumoConsulta = (id, pacienteNome, medicoNome, especialidadeNome, dataHora, estado) => ({
    id,
    paciente_nome: pacienteNome,
    medico_nome: medicoNome,
    especialidade_nome: especialidadeNome,
    data_hora: typeof dataHora === 'string' ? dataHora : dataHora.toISOString(),
    estado,
    duracao_min: 60
  });

  const registarEvento = (tipo, consulta, extra = {}, criadoEm = agora) => {
    const resultado = db.prepare(
      'INSERT INTO eventos (tipo, payload, criado_em, processado_em) VALUES (?, ?, ?, ?)'
    ).run(tipo, JSON.stringify({ consulta, ...extra }), criadoEm, criadoEm);
    const eventoId = Number(resultado.lastInsertRowid);
    for (const consumidor of ['NotificacaoService', 'RelatorioService', 'AuditoriaService']) {
      db.prepare(`
        INSERT INTO evento_consumos (evento_id, consumidor, estado, detalhe, criado_em)
        VALUES (?, ?, 'sucesso', NULL, ?)
      `).run(eventoId, consumidor, criadoEm);
    }
    return eventoId;
  };

  const notificar = ({ utilizadorId, consultaId, evento, assunto, corpo, canal = 'email', estado = 'enviada', lidaEm = null, criadoEm = agora }) => {
    db.prepare(`
      INSERT INTO notificacoes (utilizador_id, consulta_id, canal, evento, assunto, corpo, estado, lida_em, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(utilizadorId, consultaId, canal, evento, assunto, corpo, estado, lidaEm, criadoEm);
  };

  const passosAprovados = [
    { elo: 'Antecedência mínima', codigo: 'RN-01', aprovado: true, mensagem: 'Antecedência suficiente.', detalhe: '26.00h de antecedência.', duracaoMs: 0.41 },
    { elo: 'Horário de funcionamento e disponibilidade', codigo: 'RN-09', aprovado: true, mensagem: 'Dentro do horário da clínica e da disponibilidade do médico.', detalhe: null, duracaoMs: 0.86 },
    { elo: 'Conflito de agenda', codigo: 'RN-05', aprovado: true, mensagem: 'Horário livre na agenda do médico.', detalhe: null, duracaoMs: 0.73 },
    { elo: 'Limite diário do médico', codigo: 'RN-03', aprovado: true, mensagem: 'Limite diário ainda não atingido.', detalhe: '0/8 consultas no dia.', duracaoMs: 0.64 },
    { elo: 'Limite de consultas do paciente', codigo: 'RN-06', aprovado: true, mensagem: 'Dentro do limite de consultas activas.', detalhe: '1/3.', duracaoMs: 0.58 }
  ];

  const registarTrace = ({ consultaId, resultado, tipo, pedido, passos, criadoEm = agora }) => {
    db.prepare(`
      INSERT INTO validacoes_traces (consulta_id, resultado, detalhes, criado_em)
      VALUES (?, ?, ?, ?)
    `).run(consultaId ?? null, resultado, JSON.stringify({ passos, tipo, pedido }), criadoEm);
  };

  const consultaFuturaResumo = resumoConsulta(
    cFutura, 'Maria Silva', 'Dr. António Nhampossa', 'Cardiologia', amanha, 'confirmada'
  );
  const consultaPassadaResumo = resumoConsulta(
    c1, 'Maria Silva', 'Dr. António Nhampossa', 'Cardiologia', emDias(-7, '09:00'), 'realizada'
  );
  const consultaCanceladaResumo = resumoConsulta(
    c3, 'Ana Chissano', 'Dra. Ana Lopes', 'Pediatria', emDias(-3, '15:00'), 'cancelada'
  );
  const consultaPendenteResumo = resumoConsulta(
    cPendente, 'Ana Chissano', 'Dra. Ana Lopes', 'Pediatria', emDias(3, '09:00'), 'pendente'
  );

  const ha24h = adicionarHoras(agora, -24).toISOString();
  const ha23h = adicionarHoras(agora, -23).toISOString();
  const ha3h = adicionarHoras(agora, -3).toISOString();
  const ha2d = adicionarHoras(agora, -48).toISOString();
  const ha7d = adicionarHoras(agora, -7 * 24).toISOString();

  registarEvento('ConsultaCriada', consultaFuturaResumo, {}, ha24h);
  registarEvento('ConsultaConfirmada', consultaFuturaResumo, {}, ha23h);
  registarEvento('Lembrete24h', consultaFuturaResumo, { janela: 'Lembrete24h' }, ha3h);
  registarEvento('ConsultaRealizada', consultaPassadaResumo, {}, ha7d);
  registarEvento('ConsultaCancelada', consultaCanceladaResumo, { motivo: 'Imprevisto familiar' }, ha2d);
  registarEvento('ConsultaCriada', consultaPendenteResumo, {}, adicionarHoras(agora, -0.5).toISOString());

  notificar({
    utilizadorId: mariaUtilizadorId, consultaId: cFutura, evento: 'ConsultaCriada',
    assunto: 'Consulta marcada — Cardiologia',
    corpo: 'Olá Maria Silva,\n\nA sua consulta de Cardiologia com Dr(a). Dr. António Nhampossa foi registada para ' +
      `${formatarDataHora(amanha)} (60 min).\n\nEstado: PENDENTE. Confirme a marcação no prazo de 2 horas.\n\nMediAgenda`,
    criadoEm: ha24h
  });
  notificar({
    utilizadorId: mariaUtilizadorId, consultaId: cFutura, evento: 'ConsultaConfirmada',
    assunto: 'Consulta confirmada — Cardiologia',
    corpo: `A consulta de Maria Silva com Dr(a). Dr. António Nhampossa em ${formatarDataHora(amanha)} foi confirmada.\n\nEstado: CONFIRMADA.`,
    estado: 'lida', lidaEm: ha23h, criadoEm: ha23h
  });
  notificar({
    utilizadorId: mariaUtilizadorId, consultaId: cFutura, evento: 'Lembrete24h',
    assunto: 'Lembrete de consulta (24h) — Cardiologia',
    corpo: `Lembrete: a sua consulta de Cardiologia com Dr(a). Dr. António Nhampossa é em ${formatarDataHora(amanha)} (60 min).\n\nMediAgenda`,
    criadoEm: ha3h
  });
  notificar({
    utilizadorId: antonioUtilizadorId, consultaId: cFutura, evento: 'ConsultaConfirmada', canal: 'email',
    assunto: 'Consulta confirmada — Cardiologia (Maria Silva)',
    corpo: `A consulta de Maria Silva consigo em ${formatarDataHora(amanha)} foi confirmada.\n\nEstado: CONFIRMADA.`,
    criadoEm: ha23h
  });
  notificar({
    utilizadorId: anaUtilizadorId, consultaId: c3, evento: 'ConsultaCancelada',
    assunto: 'Consulta cancelada — Pediatria',
    corpo: `A consulta de Ana Chissano com Dr(a). Dra. Ana Lopes marcada para ${formatarDataHora(emDias(-3, '15:00'))} foi cancelada.\nMotivo: Imprevisto familiar`,
    criadoEm: ha2d
  });
  notificar({
    utilizadorId: anaUtilizadorId, consultaId: cPendente, evento: 'ConsultaCriada',
    assunto: 'Consulta marcada — Pediatria',
    corpo: `Olá Ana Chissano,\n\nA sua consulta de Pediatria com Dr(a). Dra. Ana Lopes foi registada para ${formatarDataHora(emDias(3, '09:00'))} (60 min).\n\nEstado: PENDENTE. Confirme a sua presença através do link abaixo (link de demonstração).\n\nhttp://localhost:5173/confirmar-consulta?id=${cPendente}&token=demo-consulta-pendente\n\nMediAgenda`,
    criadoEm: adicionarHoras(agora, -0.5).toISOString()
  });

  registarTrace({
    consultaId: cFutura, resultado: 'aprovado', tipo: 'marcacao',
    pedido: { paciente: 'Maria Silva', medico: 'Dr. António Nhampossa', especialidade: 'Cardiologia', dataHora: amanha.toISOString(), duracaoMin: 60, estrategiaDuracao: 'especialidade' },
    passos: passosAprovados, criadoEm: ha24h
  });
  registarTrace({
    consultaId: diaCheioIds[0], resultado: 'rejeitado', tipo: 'marcacao',
    pedido: { paciente: 'Maria Silva', medico: 'Dr. António Nhampossa', especialidade: 'Cardiologia', dataHora: combinarDataHora(chaveData(diaCheio), '18:00').toISOString(), duracaoMin: 60, estrategiaDuracao: 'especialidade' },
    passos: [
      ...passosAprovados.slice(0, 3),
      { elo: 'Limite diário do médico', codigo: 'RN-03', aprovado: false, mensagem: 'Este médico já atingiu o limite de 8 consultas para este dia (RN-03).', detalhe: 'Consultas no dia: 8/8.', duracaoMs: 0.69 }
    ],
    criadoEm: ha3h
  });
  registarTrace({
    consultaId: null, resultado: 'rejeitado', tipo: 'simulacao',
    pedido: { paciente: 'Maria Silva', medico: 'Dr. António Nhampossa', especialidade: 'Cardiologia', dataHora: emDias(7, '10:00').toISOString(), duracaoMin: 60, estrategiaDuracao: 'especialidade' },
    passos: [
      ...passosAprovados.slice(0, 4),
      { elo: 'Limite de consultas do paciente', codigo: 'RN-06', aprovado: false, mensagem: 'Já tem 3 consultas futuras activas com este médico (RN-06).', detalhe: 'Cancele ou reagende uma das consultas existentes.', duracaoMs: 0.61 }
    ],
    criadoEm: ha3h
  });

  // Auditoria inicial e operações de demonstração
  const auditar = (acao, entidade, detalhes, opcoes = {}) => db.prepare(`
    INSERT INTO auditoria (utilizador_id, acao, entidade, entidade_id, detalhes, ip, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    opcoes.utilizadorId ?? adminId, acao, entidade, opcoes.entidadeId ?? null,
    JSON.stringify(detalhes), opcoes.ip ?? '127.0.0.1', opcoes.criadoEm ?? agora
  );
  auditar('SISTEMA_INICIALIZADO', 'sistema', { versao: '1.0.0', origem: 'seed' });
  auditar('CONSULTA_CRIADA', 'consulta', {
    facade: 'AgendamentoFacade.marcar', medico: 'Dr. António Nhampossa',
    especialidade: 'Cardiologia', validacoes: ['RN-01:ok', 'RN-09:ok', 'RN-05:ok', 'RN-03:ok', 'RN-06:ok']
  }, { entidadeId: cFutura, criadoEm: ha24h });
  auditar('CONSULTA_CONFIRMADA', 'consulta', { estadoAnterior: 'pendente' }, { entidadeId: cFutura, criadoEm: ha23h });
  auditar('CONSULTA_CANCELADA', 'consulta', {
    comando: 'CancelarConsultaCommand', motivo: 'Imprevisto familiar', tardio: false, estadoAnterior: 'confirmada'
  }, { entidadeId: c3, utilizadorId: adminId, criadoEm: ha2d });
  auditar('LOGIN', 'utilizador', null, { entidadeId: mariaUtilizadorId, utilizadorId: mariaUtilizadorId, ip: '127.0.0.1', criadoEm: ha3h });

  const contar = (tabela) => Number(db.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get().total);

  return {
    criado: true,
    resumo: {
      utilizadores: contar('users'),
      pacientes: contar('pacientes'),
      medicos: contar('medicos'),
      medicosAtivos: Number(db.prepare('SELECT COUNT(*) AS total FROM medicos WHERE ativo = 1').get().total),
      aprovacoesPendentes: Number(db.prepare("SELECT COUNT(*) AS total FROM users WHERE estado_aprovacao = 'pendente'").get().total),
      cidades: Number(db.prepare('SELECT COUNT(DISTINCT localizacao) AS total FROM medicos WHERE ativo = 1').get().total),
      especialidades: contar('especialidades'),
      consultas: contar('consultas'),
      eventos: contar('eventos'),
      notificacoes: contar('notificacoes'),
      traces: contar('validacoes_traces')
    },
    credenciais: {
      admin: 'admin@mediagenda.co.mz / Admin@123',
      secretaria: 'secretaria@mediagenda.co.mz / Secretaria@123',
      medico: 'antonio@mediagenda.co.mz / Medico@123',
      paciente: 'maria@example.com / Paciente@123',
      medicoPendente: 'dr.pendente@mediagenda.co.mz / Medico@123',
      secretariaPendente: 'secretaria.pendente@mediagenda.co.mz / Secretaria@123'
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
