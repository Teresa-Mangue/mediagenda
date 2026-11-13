# MediAgenda — Guia de Defesa

> Documento de apoio à apresentação: como arrancar no VS Code, o que tem de estar ligado,
> onde está cada padrão e cada regra de negócio, guião de demonstração e perguntas prováveis.

---

## 1. Em 30 segundos

O **MediAgenda** é um sistema de marcação e gestão de consultas médicas de uma clínica com
presença nas principais cidades de Moçambique. É um **monólito modular**:

| Camada | Tecnologia | Pasta |
| --- | --- | --- |
| Interface | React 18 + Vite (JavaScript, CSS próprio) | `web/src` |
| API | Node.js 24 + Express | `server/src/api` |
| Domínio / padrões | State, Chain, Strategy, Factory, Adapter, Command, Façade, Observer | `server/src/domain`, `commands`, `services`, `events` |
| Persistência | SQLite nativo (`node:sqlite`), sem ORM | `server/src/repositories`, `db` |
| Testes | `node:test` (52 testes) | `server/tests` |

O que distingue o trabalho:

1. **Os padrões estão a correr**, não apenas desenhados. A cadeia de validação é executada a cada
   marcação e o resultado (com tempos por elo) fica gravado e visível no **X-Ray**.
2. **Aprovação real de contas**: médico só entra depois de a **secretária** confirmar; secretária só
   entra depois de o **administrador** autorizar.
3. **Confirmação por e-mail** com link de uso único (SMTP real via `nodemailer`, com fallback para
   outbox quando não há servidor configurado).
4. **Permissões operacionais separadas**: o administrador vê e configura, mas **não** confirma,
   cancela nem reagenda consultas.
5. **Rede nacional**: 16 médicos activos em 8 cidades (Maputo, Matola, Beira, Nampula, Quelimane,
   Tete, Chimoio, Pemba) + 2 contas pendentes para demonstrar as aprovações.

---

## 2. Antes da defesa — checklist de arranque

### 2.1 O que tem de estar instalado

| Item | Versão mínima | Como confirmar |
| --- | --- | --- |
| Node.js | **24** (obrigatório — `node:sqlite`) | `node -v` → `v24.x` |
| npm | incluído no Node | `npm -v` |
| VS Code | qualquer versão recente | — |
| Navegador | Chrome/Edge actualizado | — |

> Com Node 20 ou 22 a aplicação **não arranca** (`node:sqlite` não existe).

### 2.2 Arranque no VS Code (passo a passo)

1. **Abrir a pasta** `D:\MediAgenda` no VS Code (`File → Open Folder`).
2. Abrir o terminal integrado: `Ctrl + Ê` (ou `Terminal → New Terminal`).
3. Confirmar que está em `D:\MediAgenda`: `pwd`.
4. **Instalar dependências** (só na primeira vez): `npm install`.
5. **Renovar os dados de demonstração** (recomendado antes da defesa): `npm run reset`.
   Recria 16 médicos activos, 15 consultas, eventos, notificações, auditoria e as duas contas
   pendentes.
6. **Arrancar tudo**: `npm run dev`.

   | Processo | Porta | Para que serve |
   | --- | --- | --- |
   | API Express | **4000** | chamadas `/api/*`, scheduler, notificações |
   | Vite (React) | **5173** | interface, com proxy de `/api` para a 4000 |

7. Abrir <http://localhost:5173>.
8. Confirmar a API: <http://localhost:4000/api/health> deve devolver `{"ok":true,...}`.

> **Alternativa em dois terminais** (se o `concurrently` der problemas no Windows):
> terminal 1 `npm start`; terminal 2 `npx vite --config web/vite.config.js`.

### 2.3 O que tem de estar ligado

| Componente | Obrigatório? | Como verificar |
| --- | --- | --- |
| `npm run dev` a correr | **Sim** | devem aparecer as linhas `API` e `WEB` |
| API na porta 4000 | **Sim** | <http://localhost:4000/api/health> |
| Vite na porta 5173 | **Sim** (para a UI) | <http://localhost:5173> |
| Servidor SMTP | Não (opcional) | sem SMTP os e-mails ficam em `server/outbox/email` |
| Internet | Não | tudo corre localmente |

### 2.4 Abas a deixar abertas

1. <http://localhost:5173> — página inicial (pesquisa de médicos e “Onde estamos”).
2. <http://localhost:4000/api/health> — prova de que a API está viva.
3. Janela anónima para alternar entre **dois perfis** sem logout.
4. Pasta `D:\MediAgenda\server\outbox\email` aberta no Explorador.

### 2.5 Reinício limpo

```powershell
npm run reset      # recria os dados de demonstração
npm run dev        # volta a arrancar API + interface
```

Porta ocupada:

```powershell
Get-NetTCPConnection -LocalPort 4000,5173 -State Listen | Select-Object LocalPort,OwningProcess
Stop-Process -Id <PID> -Force
```

---

## 3. Contas de demonstração

| Perfil | E-mail | Palavra-passe | Notas |
| --- | --- | --- | --- |
| Administrador | `admin@mediagenda.co.mz` | `Admin@123` | aprova contas, relatórios, **não** opera consultas |
| Secretária | `secretaria@mediagenda.co.mz` | `Secretaria@123` | aprova **médicos**, cria médicos, opera consultas |
| Médico | `antonio@mediagenda.co.mz` | `Medico@123` | Dr. António Nhampossa — Tete, Cardiologia |
| Paciente | `maria@example.com` | `Paciente@123` | paciente com histórico |
| **Médico pendente** | `dr.pendente@mediagenda.co.mz` | `Medico@123` | login **bloqueado** até a secretária aprovar |
| **Secretária pendente** | `secretaria.pendente@mediagenda.co.mz` | `Secretaria@123` | login **bloqueado** até o admin aprovar |

Outros médicos (todos `Medico@123`): `joaquim@`, `ana.medica@`, `lucia@`, `nelson@`, `fatima@`,
`helder@`, `rosalia@`, `americo@`, `isabel@`, `zacarias@`, `celeste@`, `elias@`, `noemia@`,
`barnabe@`, `sonia@` — todos `@mediagenda.co.mz`.
Outros pacientes (`Paciente@123`): `carlos@example.com`, `ana@example.com`.

---

## 4. Estrutura do projecto

```
D:\MediAgenda
├─ server
│  ├─ src
│  │  ├─ api
│  │  │  ├─ app.js               Express, rotas e ficheiros estáticos
│  │  │  ├─ middleware.js        Bearer, RBAC (exigirPerfil), erros, rate limit
│  │  │  └─ routes
│  │  │     ├─ auth.js           registo, login, confirmação de e-mail, recuperação
│  │  │     ├─ publico.js        clínica, médicos, horários,
│  │  │     │                    confirmação pública de consulta (link do e-mail)
│  │  │     ├─ consultas.js      marcar, listar, confirmar, cancelar, reagendar, realizar, avaliar
│  │  │     ├─ medico.js         agenda e disponibilidade do médico
│  │  │     ├─ pacientes.js      gestão de pacientes (secretária)
│  │  │     ├─ secretaria.js     médicos + aprovações da secretária
│  │  │     ├─ admin.js          relatórios, utilizadores, aprovações, configuração
│  │  │     ├─ notificacoes.js   caixa de notificações
│  │  │     └─ demo.js           Architecture Lab, tick do scheduler, estado do sistema
│  │  ├─ commands/consultaCommands.js     Command: cancelar e reagendar
│  │  ├─ config/ConfiguracaoSistema.js    Singleton de configuração
│  │  ├─ db
│  │  │  ├─ schema.sql           tabelas, índices e chaves estrangeiras
│  │  │  ├─ index.js             ligação SQLite (node:sqlite)
│  │  │  └─ seed.js              dados de demonstração (rede nacional + pendentes)
│  │  ├─ domain
│  │  │  ├─ consulta/estados.js           State
│  │  │  ├─ validacao/cadeia.js           Chain of Responsibility (RN-01…RN-09)
│  │  │  └─ notificacao
│  │  │     ├─ canais.js                  ISP + Adapter (SMTP real, SMS, WhatsApp)
│  │  │     ├─ factory.js                 Factory Method
│  │  │     └─ estrategias.js             Strategy (canal e duração)
│  │  ├─ events/EventBus.js               EDA + Observer + outbox
│  │  ├─ repositories/*.js                Repository (SQL encapsulado)
│  │  ├─ services
│  │  │  ├─ AgendamentoFacade.js          Façade de marcação/cancelamento/reagendamento
│  │  │  ├─ ConsultaService.js            confirmar, realizar, expirar, lembretes, links
│  │  │  ├─ AuthService.js                registo, aprovação, login, e-mails
│  │  │  ├─ MedicoService.js              horários, desactivar (RN-08)
│  │  │  ├─ NotificacaoService.js         observador de eventos → canais
│  │  │  └─ RelatorioService.js           KPIs, relatórios e CSV
│  │  ├─ container.js            injecção de dependências (composição)
│  │  └─ index.js                arranque da API + scheduler (60 s)
│  ├─ tests/                     52 testes (node:test)
│  ├─ outbox/                    e-mails/SMS/WhatsApp gerados (auditáveis)
│  └─ data/mediagenda.db         base SQLite (criada no arranque)
├─ web/src
│  ├─ App.jsx                    rotas públicas e protegidas
│  ├─ auth.jsx                   contexto de sessão
│  ├─ api.js                     cliente HTTP + token
│  ├─ pages/                     Login, Registo, Inicio, painéis, confirmações, Arquitetura…
│  ├─ components/                Layout, UI, AcoesConsulta (permissões por perfil)
│  └─ styles.css                 design system, modo escuro, responsividade
└─ docs/                         ARQUITETURA.md, API.md, GUIA-DEFESA.md
```

---

## 5. Onde está cada padrão (com o código)

### 5.1 Singleton — `server/src/config/ConfiguracaoSistema.js`

```js
export class ConfiguracaoSistema {
  static #instancia = null;
  static obterInstancia() {
    if (!ConfiguracaoSistema.#instancia) {
      ConfiguracaoSistema.#instancia = new ConfiguracaoSistema();
    }
    return ConfiguracaoSistema.#instancia;
  }
```

Uma única configuração (horário, antecedência, limites, prazo de confirmação) partilhada por todos
os serviços. Alterações em **Admin → Configuração** entram imediatamente na cadeia de validação.

### 5.2 Chain of Responsibility — `server/src/domain/validacao/cadeia.js`

```js
export class Validador {
  definirProximo(validador) { this.proximo = validador; return validador; }
  executar(contexto) {
    const resultado = this.verificar(contexto);
    if (!resultado.ok) return { ok: false, falhouEm: this.codigo };
    return this.proximo ? this.proximo.executar(contexto) : { ok: true };
  }
}
```

Cinco elos independentes, por esta ordem:

| Ordem | Classe | Regra |
| --- | --- | --- |
| 1 | `AntecedenciaMinima` | RN-01 |
| 2 | `HorarioFuncionamento` | RN-09 (horário + disponibilidade + bloqueios) |
| 3 | `ConflitoAgenda` | RN-05 |
| 4 | `LimiteDiarioMedico` | RN-03 |
| 5 | `LimitePaciente` | RN-06 |

**Onde ver na UI:** ao marcar, o modal mostra os 5 elos com ✅/❌ e a duração de cada um.
O trace fica em `validacoes_traces` e aparece no **X-Ray** da consulta e no **Architecture Lab**.

### 5.3 State — `server/src/domain/consulta/estados.js`

```js
export class EstadoPendente extends EstadoConsulta {
  confirmar(consulta, agora) { /* RN-07: só dentro do prazo */ }
  cancelar(consulta, agora) { /* RN-02: calcula se é tardio */ }
  get transicoes() { return ['confirmada', 'cancelada']; }
}
```

```
pendente ──confirmar──► confirmada ──realizar──► realizada
   │                        │
   └──────cancelar──────────┴──► cancelada
```

Cada estado recusa operações inválidas com `TRANSICAO_INVALIDA` (HTTP 409) — não há
`if (estado === 'pendente')` espalhado pelos serviços.

### 5.4 Strategy — `server/src/domain/notificacao/estrategias.js`

```js
const ESTRATEGIAS = {
  email: new EstrategiaEmail(),
  sms: new EstrategiaSMS(),
  ambos: new EstrategiaAmbos(),
  whatsapp: new EstrategiaWhatsApp()
};
export function obterEstrategiaNotificacao(preferencia) {
  return ESTRATEGIAS[preferencia] || ESTRATEGIAS.email;
}
```

Duas estratégias: **canal de notificação** (preferência do utilizador) e **duração da consulta**
(`DuracaoPadrao` vs. `DuracaoPorEspecialidade`, RN-04, limitada a 60–120 min).
**Demonstração:** Perfil → Notificações → WhatsApp; sem telefone recua para e-mail.

### 5.5 Factory Method — `server/src/domain/notificacao/factory.js`

```js
export class NotificacaoFactory {
  criar(tipo) {
    if (tipo === 'email') return new EmailNotificacao(this.#email);
    if (tipo === 'sms') return new SMSNotificacao(this.#sms);
    if (tipo === 'whatsapp') return new WhatsAppNotificacao(this.#whatsapp);
    throw new Error(`Tipo de notificação desconhecido: ${tipo}`);
  }
}
```

Quem chama pede `criar('email')` e recebe a classe concreta — sem conhecer a construção.
Acrescentar um canal novo não altera o `NotificacaoService`.

### 5.6 Adapter + ISP — `server/src/domain/notificacao/canais.js`

```js
export class IEnviadorEmail {
  async enviarEmail() { throw new Error('não implementado'); }
}

export class AdapterSMTP extends IEnviadorEmail {
  get configurado() { return Boolean(this.host && this.utilizador && this.password); }

  async enviarEmail({ para, assunto, corpo }) {
    // grava sempre uma cópia em outbox/email
    if (!this.configurado) return { id, ficheiro, provedor: 'SMTP simulado (outbox)' };
    const transporte = await this.#obterTransporte();      // nodemailer
    const info = await transporte.sendMail({ from: this.remetente, to: para, subject: assunto, text: corpo });
    return { id, ficheiro, provedor: 'SMTP real (nodemailer)', messageId: info.messageId };
  }
}
```

- `IEnviadorEmail`, `IEnviadorSMS` e `IEnviadorWhatsApp` são **interfaces pequenas (ISP)**.
- O `AdapterWhatsApp` foi acrescentado **sem alterar nenhum serviço existente**.
- O `AdapterSMTP` fala **SMTP real** (`nodemailer`) quando existem variáveis de ambiente; sem elas
  grava em `server/outbox/email` para a demonstração offline.

### 5.7 Façade — `server/src/services/AgendamentoFacade.js`

```js
export class AgendamentoFacade {
  async marcar({ utilizador, pacienteId, medicoId, especialidadeId, dataHora, ip }) {
    // permissões → duração (Strategy) → cadeia → persistência → evento → auditoria
  }
}
```

Uma única chamada esconde a sequência completa. O frontend **nunca** executa regras de negócio;
fala apenas com a Façade através de `/api/consultas`.

### 5.8 Command — `server/src/commands/consultaCommands.js`

```js
export class CancelarConsultaCommand extends Command {
  descricao() { return 'Cancelamento de consulta'; }
  async executar({ utilizador, consultaId, motivo, ip }) {
    // perfil e propriedade → State → histórico → evento → auditoria
  }
}
```

Cada operação crítica é um objecto que **sabe descrever-se** para a auditoria.
O administrador é bloqueado aqui — no servidor, não só na interface.

### 5.9 Observer + EDA + Outbox — `server/src/events/EventBus.js`

```js
async publicar(tipo, payload) {
  const eventoId = this.#eventoRepository.criar(tipo, payload);   // outbox primeiro
  for (const { nome, handler } of this.#subscritores.get(tipo) || []) {
    await handler({ id: eventoId, tipo, payload });
    this.#eventoRepository.registarConsumo(eventoId, nome, 'sucesso', null);
  }
  this.#eventoRepository.marcarProcessado(eventoId);
}
```

Três observadores independentes em `container.js`:

| Observador | Reacção |
| --- | --- |
| `NotificacaoService` | envia e-mail/SMS/WhatsApp ao paciente e ao médico |
| `RelatorioService` | invalida a cache dos KPIs |
| `AuditoriaService` | regista `EVENTO:<tipo>` |

**Onde ver na UI:** **Architecture Lab → Event Monitor** (eventos, consumidores e outbox) e a página
**Notificações**.

### 5.10 Repository + DIP — `server/src/repositories/*.js` e `container.js`

```js
export const agendamentoFacade = new AgendamentoFacade({
  consultaRepository: repositorios.consultas,
  medicoRepository: repositorios.medicos,
  eventoBus,
  auditoriaService,
  cadeia,
  duracaoStrategy,
  traceRepository: repositorios.traces,
  configuracao
});
```

Os serviços dependem de **abstrações** injectadas no `container`. Nenhum serviço escreve SQL:
todo o acesso a dados está nos repositórios. Trocar SQLite por PostgreSQL implica mudar apenas
essa camada.

### 5.11 Outros princípios

| Princípio | Onde se prova |
| --- | --- |
| **SRP** | cada validador valida **uma** regra; cada serviço tem um caso de uso |
| **OCP** | canal WhatsApp acrescentado sem alterar serviços existentes |
| **LSP** | `EstadoPendente`, `EstadoConfirmada`… substituem `EstadoConsulta` |
| **ISP** | interfaces separadas para e-mail, SMS e WhatsApp |
| **DIP** | serviços recebem repositórios por injecção (`container.js`) |
| **DRY** | `utils/tempo.js`, `utils/security.js`, `utils/erros.js` |
| **KISS** | SQLite embutido, sem Docker, sem ORM, sem Tailwind |

---

### 5.12 Requisitos funcionais — rastreabilidade com o enunciado

| RF | Requisito (PDF) | Onde está implementado | Onde ver |
| --- | --- | --- | --- |
| RF-01 | Registo + confirmação de e-mail | `AuthService.registar`, `auth.js`, `ConfirmarEmail.jsx` | `/registo`, `/confirmar-email` |
| RF-02 | Autenticação, recuperação e RBAC | `AuthService.login/recuperar`, `middleware.autenticar/exigirPerfil` | `/login`, `/redefinir` |
| RF-03 | Pesquisa e marcação de consultas | `publico.js`, `AgendamentoFacade.marcar`, `MedicoDetalhe.jsx` | página inicial → médico → slot |
| RF-04 | Agenda, disponibilidade e bloqueios | `medicoService.definirDisponibilidades`, `PainelMedico.jsx` | `/medico` → Disponibilidade |
| RF-05 | Cancelamento e reagendamento | `CancelarConsultaCommand`, `ReagendarConsultaCommand` | `AcoesConsulta` em todas as listas |
| RF-06 | Notificações (confirmação, 24h, 1h, cancelamento) | `NotificacaoService`, scheduler, `canais.js` | `/notificacoes`, `server/outbox` |
| RF-07 | Histórico com filtros | `MinhasConsultas.jsx`, `ConsultaRepository.listar*` | `/consultas` |
| RF-08 | Painel do médico | `medico.js`, `PainelMedico.jsx` | `/medico` |
| RF-09 | Cadastro e gestão de pacientes | `pacientes.js`, separador **Pacientes** | `/secretaria` |
| RF-10 | Cadastro de médicos | `secretaria.js`, `admin.js`, `PainelSecretario.jsx` | `/secretaria` → **+ Novo médico** |
| RF-11 | Gestão de especialidades | `admin.js` (`/especialidades`), `PainelAdmin.jsx` | `/admin` → Configuração |
| RF-12 | Avaliação de consultas (1–5) | `avaliacoes` + `ConsultaDetalhe.jsx` | consulta realizada → **Avaliar** |
| RF-13 | Relatórios e estatísticas | `RelatorioService.resumo/relatorioMedico` | `/admin` → Relatórios |
| RF-14 | Pesquisa por nome, especialidade, localização e avaliação | `medicoService.listar` (`avaliacaoMin`) | página inicial (pesquisa e cartões) |

As RN-01…RN-09 estão na secção 6; os RNF estão no `README.md` (secção 2) e o mapa completo
RF/RN/RNF está no `README.md`.

---

## 6. Regras de negócio — onde estão no código

| ID | Regra | Implementação | Como demonstrar |
| --- | --- | --- | --- |
| RN-01 | Antecedência mínima de 1h | `AntecedenciaMinima` (`cadeia.js`) | marcar a menos de 1h → cadeia pára no 1.º elo |
| RN-02 | Cancelar < 24h é tardio e fica registado | `EstadoPendente/Confirmada.cancelar` | cancelar uma consulta de amanhã → badge “tardio” |
| RN-03 | Limite diário do médico (10; Dr. António = 8) | `LimiteDiarioMedico` | Architecture Lab → **Preparar caso RN-03** → executar |
| RN-04 | Duração pela especialidade/médico (60–120) | `EstrategiaDuracaoConsulta` | Ortopedia (90 min) vs. Cardiologia (60) |
| RN-05 | Sem consultas simultâneas do mesmo médico | `ConflitoAgenda` | tentar o mesmo slot duas vezes |
| RN-06 | Máx. 3 consultas futuras por paciente/médico | `LimitePaciente` | repetir marcações com a mesma paciente |
| RN-07 | Confirmação em 2h, senão a vaga é libertada | `EstadoPendente.confirmar` + scheduler | Admin → **Executar scheduler** |
| RN-08 | Desactivar médico cancela futuras e notifica | `MedicoService.desactivar` | Admin → Médicos → Desactivar |
| RN-09 | Horário da clínica + disponibilidade + bloqueios | `HorarioFuncionamento` | domingo ou hora fora de 08:00–20:00 |

Cada execução da cadeia é gravada em `validacoes_traces`, com o resultado e o tempo de cada elo.

### 6.1 Regras novas pedidas para a defesa

| Regra | Onde está implementada | Onde se vê na UI |
| --- | --- | --- |
| Médico só entra após confirmação da **secretária** | `AuthService.registar` (`estadoAprovacao='pendente'`, `ativo=0`), `AuthService.login` (`APROVACAO_PENDENTE`), `AuthService.aprovar` | `/registo` (aviso), `/secretaria` → **Médicos & aprovações** |
| Secretária só funciona após autorização do **administrador** | `AuthService.#garantirPoderDeAprovacao`, `admin.js` | `/admin` → **Aprovações** |
| Secretária também pode **criar médicos** | `POST /api/secretaria/medicos` | `/secretaria` → **+ Novo médico** |
| Confirmar que a consulta aconteceu: **médico e secretária** | `ConsultaService.realizar` | botão “Realizada” só nesses perfis |
| Cancelar/reagendar: **paciente, médico e secretária** | `CancelarConsultaCommand`, `ReagendarConsultaCommand` | botões em `AcoesConsulta` |
| **Administrador não** faz operações operacionais | verificação de perfil nas Commands e no `ConsultaService` | no admin os botões desaparecem; API devolve 403 |
| Confirmação **real por e-mail** | `AdapterSMTP` (nodemailer) + `NotificacaoService` (link com token) | caixa real **ou** `server/outbox/email` |

### 6.2 Fluxo de aprovação

```
Formulário público /registo
        │
        ├── paciente   → conta activa de imediato
        │
        ├── médico     → estado_aprovacao = 'pendente', ativo = 0
        │                 └── notifica secretária + admin
        │                 └── secretária aprova → login passa a funcionar
        │
        └── secretária → estado_aprovacao = 'pendente', ativo = 0
                          └── notifica admin
                          └── admin aprova → login passa a funcionar
```

Em `users` ficam `estado_aprovacao`, `aprovado_em`, `aprovado_por`. Enquanto `pendente`, o login
devolve **403 `APROVACAO_PENDENTE`** (a palavra-passe é validada primeiro, para não revelar se o
e-mail existe).

> A secretária **não** aprova secretárias: a regra está no servidor
> (`AuthService.#garantirPoderDeAprovacao`) e devolve 403 mesmo por chamada directa à API.

### 6.3 Confirmação de consulta por link (uso único)

1. Ao marcar, a Façade gera `token_confirmacao` e guarda-o na consulta.
2. O e-mail inclui `http://localhost:5173/confirmar-consulta?id=<id>&token=<token>`.
3. A página pública mostra médico, especialidade, data e paciente.
4. Ao confirmar, `ConsultaService.confirmarPorLink` valida o token, aplica o State (RN-07) e
   **apaga o token** — o link deixa de funcionar (404).
5. Link pronto no seed:
   `http://localhost:5173/confirmar-consulta?id=6&token=demo-consulta-pendente`

### 6.4 Confirmação de e-mail (registo)

`POST /api/auth/registo` gera `token_confirmacao` e envia o link
`http://localhost:5173/confirmar-email?token=...`. A página confirma sem sessão e regista auditoria
(`EMAIL_CONFIRMADO`). O formulário mostra o link em modo demonstração, para não depender de uma
caixa de correio real durante a apresentação.

---

## 7. SMTP real (opcional)

Sem configuração, os e-mails são gravados em `server/outbox/email/*.eml` (abrir com o Bloco de
Notas). Para envio **real**, definir as variáveis **antes** de arrancar a API:

### PowerShell

```powershell
$env:SMTP_HOST   = "smtp.gmail.com"
$env:SMTP_PORT   = "587"
$env:SMTP_USER   = "a-sua-conta@gmail.com"
$env:SMTP_PASS   = "palavra-passe-de-aplicacao"
$env:SMTP_FROM   = "MediAgenda <a-sua-conta@gmail.com>"
$env:SMTP_SECURE = "false"
$env:MEDIAGENDA_URL = "http://localhost:5173"
npm run dev
```

### VS Code (`launch.json`)

```json
{
  "type": "node",
  "request": "launch",
  "name": "MediAgenda API",
  "program": "${workspaceFolder}/server/src/index.js",
  "env": {
    "PORT": "4000",
    "SMTP_HOST": "smtp.gmail.com",
    "SMTP_PORT": "587",
    "SMTP_USER": "a-sua-conta@gmail.com",
    "SMTP_PASS": "palavra-passe-de-aplicacao",
    "SMTP_FROM": "MediAgenda <a-sua-conta@gmail.com>",
    "MEDIAGENDA_URL": "http://localhost:5173"
  }
}
```

Notas:

- Gmail exige **palavra-passe de aplicação** (conta com verificação em dois passos).
- Mailtrap (sandbox): `SMTP_HOST=sandbox.smtp.mailtrap.io`, porta `2525`.
- Se o envio real falhar, a notificação fica registada com erro **e** a cópia em `outbox` continua
  disponível — a demonstração nunca fica bloqueada.
- Prova rápida: **Registo** de um paciente → abrir `server/outbox/email` (ou a caixa real) →
  clicar no link `confirmar-email`.

---

## 8. Guião de demonstração (10–12 minutos)

> Sugestão: dois navegadores (normal = admin, anónimo = secretária) para não perder tempo com logins.

### 0. Abertura (30 s)

- Mostrar <http://localhost:5173> sem sessão: pesquisa por especialidade/cidade, cartões de médicos,
  secção **“Onde estamos”** (8 cidades).
- Dizer: “é um monólito modular; a interface só fala com a API; o domínio está isolado.”

### 1. Registo de médico fica pendente (1 min 30 s)

1. Ir a **/registo** e escolher perfil **Médico** — mostrar o aviso “aprovação necessária”.
2. Submeter com e-mail novo (ex.: `dr.demo@mediagenda.co.mz`, nº `OM-9999`, cidade Beira).
3. Mostrar a mensagem de **cadastro pendente** e o link de confirmação de e-mail.
4. Tentar **entrar** com essas credenciais → erro **“Cadastro pendente. A secretária ainda não
   confirmou o seu registo.”** (403 `APROVACAO_PENDENTE`).

### 2. Secretária aprova o médico (1 min)

1. Iniciar sessão como **secretária** (`secretaria@mediagenda.co.mz`).
2. Abrir **Médicos & aprovações** → mostrar o cadastro pendente (e o `dr.pendente@` do seed).
3. **Aprovar** → toast; o médico passa a aparecer na lista de médicos activos.
4. (Opcional) Voltar ao outro navegador e entrar com a conta aprovada → funciona.

### 3. Secretária não pode aprovar secretárias (45 s)

1. Ainda como secretária, note-se que a lista só mostra **médicos**.
2. Mostrar no código `AuthService.#garantirPoderDeAprovacao` (ou tentar pela API) → **403**.

### 4. Administrador autoriza a secretária (1 min)

1. Sair e entrar como **admin** (`admin@mediagenda.co.mz`).
2. **Aprovações** → ver `secretaria.pendente@` (o médico aprovado já não aparece).
3. **Aprovar** a secretária.
4. Mostrar **Utilizadores** com as colunas `Aprovação` e `Estado`.

### 5. Administrador não opera consultas (1 min)

1. Ainda no admin, abrir **Relatórios** e uma consulta.
2. Mostrar que **não há botões** de confirmar/cancelar/reagendar; a mensagem explica que são
   operações da secretaria/médico.
3. (Se quiser) chamar a API directamente → **403** “O administrador não pode cancelar consultas.”

### 6. Marcar com a cadeia de validação (2 min)

1. Entrar como **paciente** (`maria@example.com`).
2. Abrir um médico (ex.: Dra. Ana Lopes, Pediatria) → escolher um slot → **Marcar**.
3. Mostrar o resultado da **cadeia**: 5 elos ✅ com tempos.
4. Repetir com um horário a menos de 1h → **RN-01** ❌ e a marcação é recusada.
5. Abrir o link de confirmação do e-mail gerado (ou o link fixo do seed:
   `http://localhost:5173/confirmar-consulta?id=6&token=demo-consulta-pendente`) → **Confirmar**.
6. Recarregar o mesmo link → **404** (token de uso único).
7. Abrir `server/outbox/email` e mostrar o `.eml` com o link.

### 7. Médico e secretária confirmam que houve consulta (1 min)

1. Como **médico** (`antonio@mediagenda.co.mz`): abrir uma consulta **confirmada** → botão
   **“Marcar como realizada”** → funciona.
2. Como **paciente**, a mesma consulta **não** mostra esse botão.
3. Como **secretária**, também consegue marcar como realizada (regra pedida).

### 8. Architecture Lab (2 min)

1. Como admin, abrir **/arquitetura**.
2. Mostrar a lista de padrões com ficheiro e descrição.
3. **Preparar caso RN-03** → **Executar cadeia** → ver o elo que falhou e o trace.
4. Abrir **Event Monitor**: eventos publicados, consumidores e cópias na outbox.
5. Mostrar a aba **“Sem padrões vs. Com padrões”**.

### 9. Fecho (1 min)

1. **/auditoria**: filtrar por `LOGIN`, `CONTA_APROVADA`, `CONSULTA_CANCELADA`, `EVENTO:`.
2. **Admin → Relatórios**: exportar **Excel (CSV)** e imprimir **PDF**.
3. Alternar **modo escuro** e estreitar a janela (responsividade).
4. Referir os **52 testes** (`npm test`) e este documento.

---

## 9. Perguntas prováveis do docente

**“Porque SQLite e não MySQL?”**
Zero configuração para a defesa e para o deploy num único processo; o acesso está isolado em
repositórios, pelo que a migração para PostgreSQL muda apenas essa camada.

**“Onde está a regra X?”**
Todas as RN-01…RN-09 estão na tabela da secção 6, com a classe e o ficheiro. As validações de
marcação estão em `domain/validacao/cadeia.js`; as transições em `domain/consulta/estados.js`.

**“A aprovação está só na interface?”**
Não. `AuthService.login` valida `estado_aprovacao` e devolve 403. Mesmo chamando a API directamente,
um médico pendente não entra. A secretária também não aprova secretárias — o servidor recusa.

**“Como garantem que o administrador não cancela consultas?”**
As Commands (`CancelarConsultaCommand`, `ReagendarConsultaCommand`) e o `ConsultaService.realizar`
verificam o perfil e lançam `ErroProibido`. Os botões desaparecem na UI, mas a defesa está no
servidor.

**“A RN-08 não é uma operação do administrador?”**
A desactivação é pedida pelo admin, mas o cancelamento das consultas futuras é executado por um
utilizador interno `{ perfil: 'sistema' }` — o admin não exerce uma operação operacional.

**“O e-mail é real?”**
Com `SMTP_*` definido, sim: o `AdapterSMTP` usa `nodemailer` e envia pela rede. Sem configuração,
grava em `server/outbox/email` para a demonstração continuar offline. Em ambos os casos fica cópia
em outbox para auditoria.

**“O que acontece se o processo cair a meio de um evento?”**
O evento é gravado primeiro na tabela `eventos` (outbox) e só depois distribuído; cada consumo fica
em `evento_consumos`. É a base para reprocessamento idempotente.

**“Quantos testes têm?”**
52, com `node:test`, em bases temporárias: estados, regras, aprovações, permissões, EDA,
segurança, API e canais.

**“Onde está a prova de que os padrões funcionam juntos?”**
No fluxo de marcação: Façade → Strategy (duração) → Chain (RN) → Repository (persistência) →
EventBus (Observer) → Factory/Adapter (notificação) → Auditoria, com State a controlar transições.

---

## 10. Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `node:sqlite` não encontrado | Node < 24 | instalar Node 24 e reabrir o terminal |
| `EADDRINUSE` na 4000/5173 | processo antigo vivo | `Get-NetTCPConnection ...` e `Stop-Process -Id <PID> -Force` |
| Interface abre mas API falha | só o Vite está a correr | `npm run dev` (arranca os dois) ou `npm start` noutro terminal |
| `ExperimentalWarning: SQLite` | aviso normal do Node | ignorar; não é erro |
| Dados de demos anteriores | base alterada | `npm run reset` (com a API parada) |
| E-mail não sai | SMTP ausente/errado | verificar `SMTP_*`; consultar `server/outbox/email` |
| Login de médico pendente falha | comportamento **correto** | aprovar em `/secretaria` |
| Login de secretária pendente falha | comportamento **correto** | aprovar em `/admin` → **Aprovações** |
| `npm test` com código 1 mas tudo `pass` | `ExperimentalWarning` no stderr | confirmar `pass 52 · fail 0` |

---

## 11. Checklist final (15 minutos antes)

- [ ] `node -v` mostra **v24**
- [ ] `npm run reset` executado
- [ ] `npm run dev` a correr (API 4000 + Vite 5173)
- [ ] <http://localhost:4000/api/health> responde `ok`
- [ ] <http://localhost:5173> abre e mostra médicos das 8 cidades
- [ ] Login admin e secretária testados
- [ ] Link `confirmar-consulta?id=6&token=demo-consulta-pendente` aberto uma vez (**não confirmar**
      antes da defesa)
- [ ] `server/outbox/email` aberto no Explorador
- [ ] Aba do **Architecture Lab** pronta (caso RN-03)
- [ ] `docs/GUIA-DEFESA.md` e `docs/ARQUITETURA.md` abertos
- [ ] Modo escuro testado
- [ ] Plano B: se o SMTP real falhar, demonstrar a outbox

---

## 12. Referências rápidas

| Documento | Conteúdo |
| --- | --- |
| `README.md` | visão geral, arranque, funcionalidades, padrões, testes |
| `docs/ARQUITETURA.md` | decisões, diagramas, camadas, rastreabilidade |
| `docs/API.md` | endpoints, códigos de erro e exemplos |
| `docs/GUIA-DEFESA.md` | este documento |
| `/arquitetura` (admin) | padrões, simulador, Event Monitor, comparação |
| `/auditoria` (admin) | registo de operações críticas |
