# API do MediAgenda

API REST em Express. Todas as respostas são JSON, excepto a exportação CSV. As datas usam **ISO 8601
UTC** (`2026-11-17T08:00:00.000Z`); a interface converte para hora local.

- Base local: `http://localhost:4000`
- Prefixo: `/api`
- Autenticação: `Authorization: Bearer <token>`
- Conteúdo: `Content-Type: application/json`

## Erros

```json
{
  "erro": "É necessário marcar com pelo menos 1h de antecedência (RN-01).",
  "codigo": "VALIDACAO_FALHOU",
  "detalhes": {
    "passos": [{ "elo": "Antecedência mínima", "codigo": "RN-01", "aprovado": false }],
    "traceId": 42,
    "rejeitadoEm": "RN-01"
  }
}
```

| Código                     | HTTP | Significado                                      |
| -------------------------- | ---- | ------------------------------------------------ |
| `NAO_AUTENTICADO`          | 401  | Token ausente, inválido ou expirado              |
| `PROIBIDO`                 | 403  | Perfil sem permissão ou recurso de outro utente  |
| `NAO_ENCONTRADO`           | 404  | Recurso inexistente                              |
| `TRANSICAO_INVALIDA`       | 409  | Estado não permite a operação                    |
| `PRAZO_CONFIRMACAO_EXPIRADO` | 409 | RN-07                                            |
| `VALIDACAO_FALHOU`         | 422  | Cadeia de validação recusou o pedido             |
| `RATE_LIMIT`               | 429  | Demasiados pedidos (300/min por IP)              |
| `APROVACAO_PENDENTE`       | 403  | Médico/secretária à espera de aprovação          |
| `APROVACAO_RECUSADA`       | 403  | Cadastro recusado pela entidade competente       |
| `CONTA_INATIVA`            | 403  | Conta desactivada                                |
| `TOKEN_INVALIDO`           | 400  | Token de confirmação/recuperação inválido        |
| `ERRO_INTERNO`             | 500  | Erro inesperado                                  |

---

## Health e catálogo público

| Método | Rota                                     | Descrição                                   |
| ------ | ---------------------------------------- | ------------------------------------------- |
| GET    | `/api/health`                            | Estado da API                               |
| GET    | `/api/clinica`                           | Configuração pública da clínica + `sedes` (cidades com médicos) |
| GET    | `/api/confirmar-consulta?id&token`       | Pré-visualização pública do link de confirmação |
| POST   | `/api/confirmar-consulta`                | `{ id, token }`; confirma a consulta sem sessão |
| GET    | `/api/especialidades`                    | Especialidades activas                      |
| GET    | `/api/medicos`                           | Lista; filtros `especialidade`, `nome`, `localizacao`, `avaliacaoMin` |
| GET    | `/api/medicos/:id`                       | Detalhe com especialidades, horários e bloqueios |
| GET    | `/api/medicos/:id/disponibilidade?data=YYYY-MM-DD` | Slots do dia com `disponivel` e `motivo` |
| GET    | `/api/medicos/:id/proximos-dias?quantidade=7` | Resumo dos próximos dias               |
| GET    | `/api/medicos/:id/avaliacoes`            | Média e lista de avaliações                 |
| GET    | `/api/horarios?medicoId=1`               | Próximos 14 dias de um médico               |

Cada slot tem o formato:

```json
{ "hora": "10:00", "dataHora": "2026-11-17T10:00:00.000Z", "disponivel": false, "motivo": "ocupado" }
```

`motivo` pode ser `passado`, `antecedencia`, `bloqueio` ou `ocupado`.

---

## Autenticação

| Método | Rota                        | Corpo / descrição                                                        |
| ------ | --------------------------- | ------------------------------------------------------------------------ |
| POST   | `/api/auth/registo`         | `{ nome, email, password, perfil?, telefone?, dataNascimento?, endereco?, numeroRegisto?, localizacao?, especialidades? }` |
| POST   | `/api/auth/login`           | `{ email, password }` → `{ token, utilizador }`                          |
| POST   | `/api/auth/confirmar-email` | `{ token }`                                                              |
| POST   | `/api/auth/recuperar`       | `{ email }`                                                              |
| POST   | `/api/auth/redefinir`       | `{ token, password }`                                                    |
| GET    | `/api/auth/me`              | Utilizador autenticado + perfil de paciente/médico                       |
| PUT    | `/api/auth/me`              | `{ nome?, telefone?, preferenciaNotificacao?, dataNascimento?, endereco? }` |

`perfil` aceita `paciente` (padrão), `medico` ou `secretario`. `preferenciaNotificacao` aceita `email`,
`sms`, `whatsapp` ou `ambos`.

O registo segue as regras de aprovação:

| Perfil | Resultado |
| ------ | --------- |
| `paciente` | conta activa de imediato (`estadoAprovacao: "aprovada"`) |
| `medico` | `estadoAprovacao: "pendente"`, login recusado até a **secretária** aprovar |
| `secretario` | `estadoAprovacao: "pendente"`, login recusado até o **administrador** aprovar |

A resposta inclui `estadoAprovacao`, `tokenConfirmacao` e `linkConfirmacao`. Enquanto pendente, o
login devolve `403 APROVACAO_PENDENTE`.

```bash
curl -s http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@example.com","password":"Paciente@123"}'
```

---

## Consultas

Todas exigem autenticação. Um paciente só vê as suas; um médico só as da sua agenda.

| Método | Rota                              | Descrição                                              |
| ------ | --------------------------------- | ------------------------------------------------------ |
| POST   | `/api/consultas`                  | `{ medicoId, especialidadeId, dataHora, pacienteId? }` |
| GET    | `/api/consultas/minhas`           | Filtros `estado`, `desde`, `ate`                       |
| GET    | `/api/consultas/:id`              | Detalhe                                                |
| GET    | `/api/consultas/:id/historico`    | Timeline + transições permitidas                       |
| GET    | `/api/consultas/:id/xray`         | Consulta + histórico + traces + eventos                |
| POST   | `/api/consultas/:id/confirmar`    | RN-07 (dentro de 2h)                                   |
| POST   | `/api/consultas/:id/cancelar`     | `{ motivo? }`; RN-02 marca tardio se < 24h             |
| PATCH  | `/api/consultas/:id/reagendar`    | `{ dataHora, motivo? }`; volta a `pendente`            |
| POST   | `/api/consultas/:id/realizar`     | Só a partir de `confirmada`; apenas **médico responsável** ou **secretária** |
| POST   | `/api/consultas/:id/avaliar`      | `{ pontuacao: 1..5, comentario? }`; só `realizada`     |

Permissões operacionais (verificadas no servidor):

| Operação | Paciente | Médico | Secretária | Admin |
| -------- | :------: | :----: | :--------: | :---: |
| Confirmar | ✅ | ✅ | ✅ | ❌ |
| Realizar | ❌ | ✅ (a sua) | ✅ | ❌ |
| Cancelar / reagendar | ✅ (a sua) | ✅ (a sua) | ✅ | ❌ |

O administrador recebe `403 PROIBIDO` em confirmar, cancelar, reagendar e realizar. A RN-08 é
executada internamente com o perfil `sistema`.

Resposta de marcação aprovada:

```json
{
  "consulta": { "id": 21, "estado": "pendente", "duracao_min": 90, "data_hora": "2026-11-27T10:00:00.000Z" },
  "validacao": {
    "traceId": 57,
    "aprovado": true,
    "passos": [{ "codigo": "RN-01", "aprovado": true, "duracaoMs": 0.41 }]
  },
  "prazoConfirmacao": "2026-11-12T18:30:00.000Z"
}
```

`pacienteId` só é necessário quando quem marca é secretária, admin ou médico; o paciente usa o seu
próprio perfil.

---

## Área do médico

Perfil `medico`.

| Método | Rota                          | Descrição                                        |
| ------ | ----------------------------- | ------------------------------------------------ |
| GET    | `/api/medico/agenda`          | Filtros `desde`, `ate`                          |
| GET    | `/api/medico/disponibilidade` | Janelas, bloqueios e resumo dos próximos 14 dias |
| PUT    | `/api/medico/disponibilidade` | `{ lista: [{ diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" }] }` |
| POST   | `/api/medico/bloqueios`       | `{ inicio, fim, motivo? }`                      |
| DELETE | `/api/medico/bloqueios/:id`   | Remove bloqueio                                 |
| GET    | `/api/medico/pacientes`       | Pacientes atendidos                              |
| GET    | `/api/medico/relatorio`       | Totais por estado e avaliações                  |
| GET    | `/api/medico/avaliacoes`      | Avaliações recebidas                            |

---

## Secretária e administração

`/api/pacientes` exige `secretario` ou `admin`:

| Método | Rota                       | Descrição                                  |
| ------ | -------------------------- | ------------------------------------------ |
| GET    | `/api/pacientes`           | Filtro `nome`                              |
| POST   | `/api/pacientes`           | `{ nome, email, telefone?, dataNascimento?, endereco?, password? }` |
| PUT    | `/api/pacientes/:id`       | Actualiza dados                            |
| GET    | `/api/pacientes/:id/consultas` | Histórico do paciente                  |

`/api/secretaria` exige `secretario`:

| Método | Rota                                      | Descrição |
| ------ | ----------------------------------------- | --------- |
| GET    | `/api/secretaria/medicos`                 | Lista de médicos (filtros `nome`, `especialidade`, `localizacao`) |
| POST   | `/api/secretaria/medicos`                 | `{ nome, email, password?, telefone?, numeroRegisto, localizacao, especialidades }`; cria médico **já aprovado** |
| GET    | `/api/secretaria/aprovacoes`              | Apenas cadastros de **médicos** pendentes |
| POST   | `/api/secretaria/aprovacoes/:id/aprovar`  | Aprova o médico; o login passa a funcionar |
| POST   | `/api/secretaria/aprovacoes/:id/recusar`  | `{ motivo? }` |

A secretária **não** pode aprovar secretárias — a API responde `403 PROIBIDO`.

`/api/admin` exige `admin`:

| Método | Rota                                  | Descrição                                      |
| ------ | ------------------------------------- | ---------------------------------------------- |
| GET    | `/api/admin/resumo`                   | KPIs globais                                   |
| GET    | `/api/admin/relatorios`               | Filtros `desde`, `ate`, `estado`               |
| GET    | `/api/admin/relatorios/export.csv`    | CSV com BOM UTF-8 e separador `;`              |
| GET    | `/api/admin/auditoria`                | Filtros `limite`, `acao`                       |
| GET    | `/api/admin/eventos`                  | Eventos + resumo por tipo/consumidor           |
| GET    | `/api/admin/validacoes`               | Últimos traces da cadeia                       |
| GET    | `/api/admin/utilizadores`             | Filtros `perfil`, `estadoAprovacao`             |
| GET    | `/api/admin/aprovacoes`               | Médicos **e** secretárias pendentes             |
| POST   | `/api/admin/utilizadores/:id/aprovar` | Aprova qualquer cadastro (inclui secretárias)   |
| POST   | `/api/admin/utilizadores/:id/recusar` | `{ motivo? }`                                   |
| GET    | `/api/admin/notificacoes`             | Outbox de notificações                         |
| POST   | `/api/admin/especialidades`           | `{ nome, descricao?, duracaoPadraoMin? }`      |
| PUT    | `/api/admin/especialidades/:id`       | Actualiza especialidade                        |
| GET    | `/api/admin/configuracoes`            | Configuração com valor actual e padrão         |
| PUT    | `/api/admin/configuracoes`            | Objecto `{ chave: valor }`                     |
| POST   | `/api/admin/medicos`                  | Cria médico e utilizador                       |
| PATCH  | `/api/admin/medicos/:id/desativar`    | RN-08: cancela futuras e desactiva             |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/admin/relatorios/export.csv" -o relatorio.csv
```

---

## Architecture Lab (demo)

| Método | Rota                        | Perfil  | Descrição                                              |
| ------ | --------------------------- | ------- | ------------------------------------------------------ |
| GET    | `/api/demo/arquitetura`     | admin   | Padrões, configuração e resumo de eventos               |
| POST   | `/api/demo/simular`         | qualquer| Executa a cadeia sem gravar consulta                    |
| POST   | `/api/demo/tick`            | admin   | Executa expiração e lembretes manualmente               |
| GET    | `/api/demo/estado`          | admin   | Últimos eventos, traces, notificações e auditoria       |

Corpo da simulação:

```json
{
  "pacienteId": 1,
  "medicoId": 2,
  "especialidadeId": 3,
  "dataHora": "2026-11-17T10:00:00.000Z"
}
```

Resposta:

```json
{
  "aprovado": false,
  "mensagem": "Este médico já atingiu o limite de 8 consultas para este dia (RN-03).",
  "falhouEm": "RN-03",
  "passos": [{ "codigo": "RN-01", "aprovado": true }],
  "traceId": 61,
  "pedido": { "medico": "Dr. António Nhampossa", "duracaoMin": 60 }
}
```

---

## Notificações e SMTP

| Método | Rota                          | Descrição                                    |
| ------ | ----------------------------- | -------------------------------------------- |
| GET    | `/api/notificacoes`           | Lista do utilizador + contagem de não lidas  |
| PATCH  | `/api/notificacoes/:id/lida`  | Marca como lida                              |

O canal é escolhido pela preferência do utilizador (`email`, `sms`, `whatsapp`, `ambos`). O
`AdapterSMTP` envia por **SMTP real** (`nodemailer`) quando `SMTP_HOST`, `SMTP_USER` e `SMTP_PASS`
estão definidos; caso contrário grava em `server/outbox/email`. Em qualquer dos casos fica sempre
uma cópia em outbox. Outras variáveis: `SMTP_PORT`, `SMTP_FROM`, `SMTP_SECURE` e
`MEDIAGENDA_URL` (links dos e-mails; padrão `http://localhost:5173`).

Links enviados por e-mail:

| Objectivo | Formato |
| --------- | ------- |
| Confirmar conta | `/confirmar-email?token=<token>` |
| Confirmar consulta | `/confirmar-consulta?id=<id>&token=<token>` |

---

## Configuração

Chaves em `configuracoes` (com padrão em `ConfiguracaoSistema`):

| Chave                            | Padrão     | Efeito                          |
| -------------------------------- | ---------- | ------------------------------- |
| `nome_clinica`                   | Clínica MediAgenda | Nome na interface       |
| `horario_inicio` / `horario_fim` | 08:00 / 20:00 | Horário da clínica (RN-09)  |
| `dias_funcionamento`             | 1,2,3,4,5  | Dias úteis (RN-09)              |
| `antecedencia_minima_horas`      | 1          | RN-01                           |
| `cancelamento_limite_horas`      | 24         | RN-02                           |
| `confirmacao_prazo_horas`        | 2          | RN-07                           |
| `max_consultas_dia`              | 10         | RN-03 (valor por médico prevalece) |
| `max_consultas_paciente_medico`  | 3          | RN-06                           |
| `duracao_padrao_min`             | 60         | Duração base                    |
| `limite_tentativas_login`        | 5          | Bloqueio temporário             |
