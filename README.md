# MediAgenda

Sistema de Agendamento de Consultas Médicas — projeto de Engenharia Informática (ISPT).

Aplicação web com **API em Node.js/Express** e **frontend em React/Vite**, com base de dados
**SQLite** (módulo nativo `node:sqlite`).

## Funcionalidades principais

- Autenticação por perfil: paciente, médico, secretária e administrador
- Marcação, confirmação, cancelamento e reagendamento de consultas
- Gestão de disponibilidades e bloqueios dos médicos
- Avaliações, notificações (outbox de email) e auditoria
- Painel administrativo com configurações da clínica
- Scheduler interno (expiração de pendentes e lembretes)

## Requisitos

- **Node.js 24 ou superior** (o projeto usa `node:sqlite`)

## Instalação e execução local

```bash
npm install
npm run setup     # cria a base de dados e os dados de demonstração
npm run dev       # API em http://localhost:4000 e frontend em http://localhost:5173
```

Para produção (build do frontend + servidor a servir os ficheiros estáticos):

```bash
npm run build
npm start         # http://localhost:4000
```

Outros comandos:

```bash
npm run seed      # repovoar apenas se a base estiver vazia
npm run reset     # apagar e recriar os dados de demonstração
npm test          # testes
```

## Contas de demonstração

| Perfil      | Email                          | Password        |
| ----------- | ------------------------------ | --------------- |
| Admin       | admin@mediagenda.co.mz         | `Admin@123`     |
| Secretária  | secretaria@mediagenda.co.mz    | `Secretaria@123`|
| Médico      | antonio@mediagenda.co.mz       | `Medico@123`    |
| Paciente    | maria@example.com              | `Paciente@123`  |

## Estrutura

```
server/src/api        rotas Express e middlewares
server/src/domain     regras de negócio
server/src/services   casos de uso
server/src/repositories  acesso à base de dados
server/src/db         schema.sql, seed e ligação SQLite
server/src/events     barramento de eventos e outbox
web/src               frontend React (páginas, componentes, estilos)
scripts               setup inicial
```

A base de dados é criada em `server/data/mediagenda.db` (pode ser alterada com a
variável de ambiente `MEDIAGENDA_DB`).

## Deploy

Ver [DEPLOY.md](DEPLOY.md) para os passos de publicação no Render.
