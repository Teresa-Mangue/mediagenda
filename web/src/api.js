const CHAVE_TOKEN = 'mediagenda_token';

export const tokenStore = {
  obter: () => localStorage.getItem(CHAVE_TOKEN),
  guardar: (token) => localStorage.setItem(CHAVE_TOKEN, token),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN)
};

export class ApiError extends Error {
  constructor(mensagem, { codigo = 'ERRO', detalhes = null, status = 0 } = {}) {
    super(mensagem);
    this.codigo = codigo;
    this.detalhes = detalhes;
    this.status = status;
  }
}

export async function api(metodo, caminho, dados) {
  const cabecalhos = { 'Content-Type': 'application/json' };
  const token = tokenStore.obter();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: dados === undefined ? undefined : JSON.stringify(dados)
    });
  } catch {
    throw new ApiError('Não foi possível ligar ao servidor. Confirme que a API está a correr.', { codigo: 'SEM_REDE' });
  }

  const texto = await resposta.text();
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }

  if (!resposta.ok) {
    if (resposta.status === 401) {
      tokenStore.limpar();
      window.dispatchEvent(new CustomEvent('mediagenda:sessao-expirada'));
    }
    throw new ApiError(
      corpo?.erro || `Erro ${resposta.status}`,
      { codigo: corpo?.codigo, detalhes: corpo?.detalhes, status: resposta.status }
    );
  }
  return corpo;
}

export const http = {
  get: (caminho) => api('GET', caminho),
  post: (caminho, dados) => api('POST', caminho, dados),
  put: (caminho, dados) => api('PUT', caminho, dados),
  patch: (caminho, dados) => api('PATCH', caminho, dados),
  del: (caminho) => api('DELETE', caminho)
};

export function urlExportacao(consulta = '') {
  return `/api/admin/relatorios/export.csv${consulta}`;
}

export async function descarregar(caminho, nomeFicheiro) {
  const token = tokenStore.obter();
  const resposta = await fetch(`/api${caminho}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!resposta.ok) throw new ApiError('Falha ao descarregar o ficheiro.', { status: resposta.status });
  const blob = await resposta.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

