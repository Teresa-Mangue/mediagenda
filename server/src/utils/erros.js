export class ErroNegocio extends Error {
  constructor(mensagem, { status = 400, codigo = 'ERRO_NEGOCIO', detalhes = null } = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export class ErroValidacao extends ErroNegocio {
  constructor(mensagem, detalhes = null) {
    super(mensagem, { status: 422, codigo: 'VALIDACAO_FALHOU', detalhes });
  }
}

export class ErroNaoEncontrado extends ErroNegocio {
  constructor(mensagem = 'Recurso não encontrado.') {
    super(mensagem, { status: 404, codigo: 'NAO_ENCONTRADO' });
  }
}

export class ErroProibido extends ErroNegocio {
  constructor(mensagem = 'Não tem permissão para esta operação.') {
    super(mensagem, { status: 403, codigo: 'PROIBIDO' });
  }
}

export class ErroAutenticacao extends ErroNegocio {
  constructor(mensagem = 'Credenciais inválidas.') {
    super(mensagem, { status: 401, codigo: 'NAO_AUTENTICADO' });
  }
}
