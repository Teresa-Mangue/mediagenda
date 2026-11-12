import { AuditoriaRepository } from '../repositories/AuditoriaRepository.js';

const repo = new AuditoriaRepository();

export class AuditoriaService {
  constructor(repository = repo) {
    this.repository = repository;
  }

  registar({ utilizadorId, acao, entidade, entidadeId, detalhes, ip }) {
    return this.repository.registar({ utilizadorId, acao, entidade, entidadeId, detalhes, ip });
  }

  listar(filtros) {
    return this.repository.listar(filtros);
  }
}

export const auditoriaService = new AuditoriaService();
