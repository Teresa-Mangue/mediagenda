import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX = path.resolve(__dirname, '..', '..', '..', 'outbox');

/**
 * ISP — interfaces pequenas e focadas. Um canal não é obrigado a
 * implementar métodos de outro canal que não utiliza.
 */
export class IEnviadorEmail {
  async enviarEmail() {
    throw new Error('IEnviadorEmail.enviarEmail() não implementado.');
  }
}

export class IEnviadorSMS {
  async enviarSMS() {
    throw new Error('IEnviadorSMS.enviarSMS() não implementado.');
  }
}

/**
 * Adapter — traduz a interface do sistema (IEnviadorEmail) para a API
 * externa (SMTP). Neste projeto a API é simulada: a mensagem é escrita
 * numa pasta `outbox` em vez de sair pela rede.
 */
export class AdapterSMTP extends IEnviadorEmail {
  constructor({ pasta = path.join(OUTBOX, 'email') } = {}) {
    super();
    this.pasta = pasta;
  }

  async enviarEmail({ para, assunto, corpo }) {
    await fs.mkdir(this.pasta, { recursive: true });
    const id = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ficheiro = path.join(this.pasta, `${id}.eml`);
    const conteudo = [
      `To: ${para}`,
      'From: MediAgenda <nao-responder@mediagenda.co.mz>',
      `Subject: ${assunto}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      corpo
    ].join('\r\n');
    await fs.writeFile(ficheiro, conteudo, 'utf8');
    return { id, ficheiro, provedor: 'SMTP simulado' };
  }
}

/**
 * Adapter — mesma ideia, mas para a API de SMS.
 * Implementa apenas IEnviadorSMS (ISP).
 */
export class AdapterSMS extends IEnviadorSMS {
  constructor({ pasta = path.join(OUTBOX, 'sms') } = {}) {
    super();
    this.pasta = pasta;
  }

  async enviarSMS({ para, mensagem }) {
    await fs.mkdir(this.pasta, { recursive: true });
    const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ficheiro = path.join(this.pasta, `${id}.txt`);
    await fs.writeFile(ficheiro, `Para: ${para}\n\n${mensagem}\n`, 'utf8');
    return { id, ficheiro, provedor: 'Gateway SMS simulado' };
  }
}

export { OUTBOX };
