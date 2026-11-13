import { EventBus } from './events/EventBus.js';
import { EventoRepository } from './repositories/EventoRepository.js';
import { ConsultaRepository } from './repositories/ConsultaRepository.js';
import { MedicoRepository } from './repositories/MedicoRepository.js';
import { PacienteRepository } from './repositories/PacienteRepository.js';
import { UtilizadorRepository } from './repositories/UtilizadorRepository.js';
import { EspecialidadeRepository } from './repositories/EspecialidadeRepository.js';
import { AuditoriaRepository } from './repositories/AuditoriaRepository.js';
import { NotificacaoRepository } from './repositories/NotificacaoRepository.js';
import { ValidacaoTraceRepository } from './repositories/ValidacaoTraceRepository.js';
import { AvaliacaoRepository } from './repositories/AvaliacaoRepository.js';
import { AuditoriaService } from './services/AuditoriaService.js';
import { NotificacaoService } from './services/NotificacaoService.js';
import { RelatorioService } from './services/RelatorioService.js';
import { AuthService } from './services/AuthService.js';
import { ConsultaService } from './services/ConsultaService.js';
import { MedicoService } from './services/MedicoService.js';
import { AgendamentoFacade } from './services/AgendamentoFacade.js';
import { CadeiaValidacao } from './domain/validacao/cadeia.js';
import { NotificacaoFactory } from './domain/notificacao/factory.js';
import { AdapterSMTP, AdapterSMS, AdapterWhatsApp } from './domain/notificacao/canais.js';
import { EstrategiaDuracaoConsulta } from './domain/notificacao/estrategias.js';
import { configuracao } from './config/ConfiguracaoSistema.js';

// ---------------------------------------------------------------------------
// Repositórios
// ---------------------------------------------------------------------------
export const repositorios = {
  consultas: new ConsultaRepository(),
  medicos: new MedicoRepository(),
  pacientes: new PacienteRepository(),
  utilizadores: new UtilizadorRepository(),
  especialidades: new EspecialidadeRepository(),
  auditoria: new AuditoriaRepository(),
  notificacoes: new NotificacaoRepository(),
  eventos: new EventoRepository(),
  traces: new ValidacaoTraceRepository(),
  avaliacoes: new AvaliacaoRepository()
};

// ---------------------------------------------------------------------------
// Serviços e padrões
// ---------------------------------------------------------------------------
export const auditoriaService = new AuditoriaService(repositorios.auditoria);

export const notificacaoService = new NotificacaoService({
  notificacaoRepository: repositorios.notificacoes,
  factory: new NotificacaoFactory({
    emailAdapter: new AdapterSMTP(),
    smsAdapter: new AdapterSMS(),
    whatsappAdapter: new AdapterWhatsApp()
  })
});

export const relatorioService = new RelatorioService();
export const eventBus = new EventBus(repositorios.eventos);
export const cadeia = new CadeiaValidacao({
  configuracao,
  medicoRepository: repositorios.medicos,
  consultaRepository: repositorios.consultas
});
export const duracaoStrategy = new EstrategiaDuracaoConsulta();

export const authService = new AuthService({
  utilizadorRepository: repositorios.utilizadores,
  pacienteRepository: repositorios.pacientes,
  medicoRepository: repositorios.medicos,
  especialidadeRepository: repositorios.especialidades,
  auditoriaService,
  notificacaoService
});

export const agendamentoFacade = new AgendamentoFacade({
  consultaRepository: repositorios.consultas,
  pacienteRepository: repositorios.pacientes,
  medicoRepository: repositorios.medicos,
  eventoBus: eventBus,
  auditoriaService,
  cadeia,
  duracaoStrategy,
  traceRepository: repositorios.traces,
  configuracao
});

export const consultaService = new ConsultaService({
  consultaRepository: repositorios.consultas,
  medicoRepository: repositorios.medicos,
  eventoBus: eventBus,
  auditoriaService
});

export const medicoService = new MedicoService({
  medicoRepository: repositorios.medicos,
  consultaRepository: repositorios.consultas,
  pacienteRepository: repositorios.pacientes,
  utilizadorRepository: repositorios.utilizadores,
  agendamentoFacade,
  configuracao
});

// ---------------------------------------------------------------------------
// Observadores do Event Bus (EDA)
// ---------------------------------------------------------------------------
const EVENTOS_CONSULTA = [
  'ConsultaCriada', 'ConsultaConfirmada', 'ConsultaCancelada',
  'ConsultaReagendada', 'ConsultaExpirada', 'ConsultaRealizada',
  'Lembrete24h', 'Lembrete1h'
];

for (const tipo of EVENTOS_CONSULTA) {
  eventBus.subscrever(tipo, 'NotificacaoService', async (evento) => {
    await notificacaoService.aoEvento(evento.tipo, evento.payload.consulta);
  });
  eventBus.subscrever(tipo, 'RelatorioService', async () => {
    relatorioService.invalidarCache();
  });
  eventBus.subscrever(tipo, 'AuditoriaService', async (evento) => {
    auditoriaService.registar({
      utilizadorId: null,
      acao: `EVENTO:${evento.tipo}`,
      entidade: 'consulta',
      entidadeId: evento.payload.consulta?.id ?? null,
      detalhes: { eventoId: evento.id, consumidores: eventBus.subscritoresDe(evento.tipo) }
    });
  });
}

export const servicos = {
  authService, consultaService, medicoService, agendamentoFacade,
  auditoriaService, notificacaoService, relatorioService, eventBus, cadeia, configuracao
};
