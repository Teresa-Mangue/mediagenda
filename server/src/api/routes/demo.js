import { Router } from 'express';
import { assincrono, autenticar, exigirPerfil } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';

export const demoRouter = Router();
demoRouter.use(autenticar);

demoRouter.get('/arquitetura', exigirPerfil('admin'), (req, res) => {
  res.json({
    padroes: [
      {
        nome: 'Event-Driven Architecture + Observer',
        ficheiro: 'server/src/events/EventBus.js',
        descricao: 'O ConsultaService publica eventos; NotificacaoService, AuditoriaService e RelatorioService consomem de forma independente.',
        tiposDeEvento: ['ConsultaCriada', 'ConsultaConfirmada', 'ConsultaCancelada', 'ConsultaReagendada', 'ConsultaExpirada', 'ConsultaRealizada', 'Lembrete24h', 'Lembrete1h'],
        consumidores: servicos.eventBus.subscritoresDe('ConsultaCriada')
      },
      {
        nome: 'State',
        ficheiro: 'server/src/domain/consulta/estados.js',
        descricao: 'Cada estado (Pendente, Confirmada, Realizada, Cancelada) decide as transições válidas.',
        transicoes: {
          pendente: ['confirmada', 'cancelada'],
          confirmada: ['cancelada', 'realizada'],
          realizada: [],
          cancelada: []
        }
      },
      {
        nome: 'Chain of Responsibility',
        ficheiro: 'server/src/domain/validacao/cadeia.js',
        descricao: 'Cinco regras independentes validam a marcação por ordem; a primeira que falhar interrompe a cadeia.',
        ordem: ['RN-01 Antecedência mínima', 'RN-09 Horário e disponibilidade', 'RN-05 Conflito de agenda', 'RN-03 Limite diário do médico', 'RN-06 Limite do paciente']
      },
      {
        nome: 'ISP',
        ficheiro: 'server/src/domain/notificacao/canais.js',
        descricao: 'IEnviadorEmail e IEnviadorSMS são contratos pequenos; cada adapter implementa apenas o seu canal.'
      },
      {
        nome: 'Factory Method',
        ficheiro: 'server/src/domain/notificacao/factory.js',
        descricao: 'NotificacaoFactory.criar("email" | "sms" | "whatsapp") devolve a classe concreta sem expor a construção.'
      },
      {
        nome: 'Strategy',
        ficheiro: 'server/src/domain/notificacao/estrategias.js',
        descricao: 'A preferência do utilizador escolhe a estratégia (e-mail, SMS ou WhatsApp); a especialidade escolhe a duração.'
      },
      {
        nome: 'Adapter',
        ficheiro: 'server/src/domain/notificacao/canais.js',
        descricao: 'AdapterSMTP, AdapterSMS e AdapterWhatsApp isolam os fornecedores externos (simulados em outbox/). O WhatsApp foi acrescentado sem alterar nenhum serviço — prova de ISP + Adapter.'
      },
      {
        nome: 'Façade',
        ficheiro: 'server/src/services/AgendamentoFacade.js',
        descricao: 'Uma única chamada executa validação, persistência, evento e auditoria.'
      },
      {
        nome: 'Command',
        ficheiro: 'server/src/commands/consultaCommands.js',
        descricao: 'CancelarConsultaCommand e ReagendarConsultaCommand registam quem, quando e porquê.'
      },
      {
        nome: 'Singleton',
        ficheiro: 'server/src/config/ConfiguracaoSistema.js',
        descricao: 'ConfiguracaoSistema é criada uma vez e partilhada por todos os serviços.'
      }
    ],
    configuracoes: servicos.configuracao.todas(),
    resumoEventos: repositorios.eventos.resumo()
  });
});

demoRouter.post('/simular', assincrono(async (req, res) => {
  const { pacienteId, medicoId, especialidadeId, dataHora } = req.body || {};
  res.json(servicos.agendamentoFacade.simular({
    utilizador: req.utilizador,
    pacienteId,
    medicoId,
    especialidadeId,
    dataHora
  }));
}));

demoRouter.post('/tick', exigirPerfil('admin'), assincrono(async (req, res) => {
  const expiradas = await servicos.consultaService.expirarPendentes();
  const lembretes = await servicos.consultaService.enviarLembretes();
  res.json({
    expiradas: expiradas.map((c) => c.id),
    lembretes,
    mensagem: 'Scheduler executado manualmente.'
  });
}));

demoRouter.get('/estado', exigirPerfil('admin'), (req, res) => {
  res.json({
    eventos: repositorios.eventos.resumo(),
    traces: repositorios.traces.listar({ limite: 10 }),
    notificacoes: repositorios.notificacoes.listarTodas({ limite: 10 }),
    auditoria: repositorios.auditoria.listar({ limite: 10 })
  });
});
