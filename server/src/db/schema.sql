PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('paciente', 'medico', 'secretario', 'admin')),
  telefone TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  email_confirmado INTEGER NOT NULL DEFAULT 0,
  estado_aprovacao TEXT NOT NULL DEFAULT 'aprovada'
    CHECK (estado_aprovacao IN ('pendente', 'aprovada', 'recusada')),
  aprovado_em TEXT,
  aprovado_por INTEGER REFERENCES users(id),
  token_confirmacao TEXT,
  token_recuperacao TEXT,
  tentativas_falhadas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT,
  preferencia_notificacao TEXT NOT NULL DEFAULT 'email'
    CHECK (preferencia_notificacao IN ('email', 'sms', 'whatsapp', 'ambos')),
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pacientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilizador_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  data_nascimento TEXT,
  endereco TEXT,
  cancelamentos_tardios INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS especialidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  duracao_padrao_min INTEGER NOT NULL DEFAULT 60,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS medicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilizador_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  numero_registo TEXT NOT NULL UNIQUE,
  localizacao TEXT,
  biografia TEXT,
  duracao_consulta_min INTEGER NOT NULL DEFAULT 60,
  max_consultas_dia INTEGER NOT NULL DEFAULT 10,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medico_especialidades (
  medico_id INTEGER NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  especialidade_id INTEGER NOT NULL REFERENCES especialidades(id) ON DELETE CASCADE,
  PRIMARY KEY (medico_id, especialidade_id)
);

CREATE TABLE IF NOT EXISTS disponibilidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medico_id INTEGER NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bloqueios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medico_id INTEGER NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  inicio TEXT NOT NULL,
  fim TEXT NOT NULL,
  motivo TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
  medico_id INTEGER NOT NULL REFERENCES medicos(id),
  especialidade_id INTEGER NOT NULL REFERENCES especialidades(id),
  data_hora TEXT NOT NULL,
  duracao_min INTEGER NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendente', 'confirmada', 'realizada', 'cancelada')),
  motivo_cancelamento TEXT,
  cancelamento_tardio INTEGER NOT NULL DEFAULT 0,
  confirmada_em TEXT,
  prazo_confirmacao TEXT NOT NULL,
  token_confirmacao TEXT,
  criada_em TEXT NOT NULL,
  atualizada_em TEXT NOT NULL,
  criada_por INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_consultas_medico_data ON consultas (medico_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_consultas_paciente ON consultas (paciente_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_consultas_estado ON consultas (estado);

CREATE TABLE IF NOT EXISTS consulta_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_novo TEXT NOT NULL,
  motivo TEXT,
  autor_id INTEGER REFERENCES users(id),
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER NOT NULL UNIQUE REFERENCES consultas(id) ON DELETE CASCADE,
  pontuacao INTEGER NOT NULL CHECK (pontuacao BETWEEN 1 AND 5),
  comentario TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilizador_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  consulta_id INTEGER REFERENCES consultas(id) ON DELETE SET NULL,
  canal TEXT NOT NULL,
  evento TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'enviada',
  criado_em TEXT NOT NULL,
  lida_em TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilizador_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id INTEGER,
  detalhes TEXT,
  ip TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  payload TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  processado_em TEXT
);

CREATE TABLE IF NOT EXISTS evento_consumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  consumidor TEXT NOT NULL,
  estado TEXT NOT NULL,
  detalhe TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS validacoes_traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER,
  resultado TEXT NOT NULL,
  detalhes TEXT NOT NULL,
  criado_em TEXT NOT NULL
);
