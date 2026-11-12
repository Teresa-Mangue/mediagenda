export function formatarDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatarHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export function chaveData(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function adicionarDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

export function diaSemanaCurto(data) {
  return new Date(data).toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
}

export function diaMes(data) {
  return new Date(data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function primeiroNome(nome = '') {
  return nome.split(' ')[0] || nome;
}

export const NOMES_ESTADO = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada'
};

export function duracaoTexto(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = minutos / 60;
  return Number.isInteger(horas) ? `${horas}h` : `${horas.toFixed(1)}h`;
}

export function tempoRestante(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'expirado';
  const horas = Math.floor(diff / 3600000);
  const minutos = Math.floor((diff % 3600000) / 60000);
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos} min`;
}
