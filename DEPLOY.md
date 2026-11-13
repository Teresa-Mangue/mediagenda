# Deploy do MediAgenda

Guia rápido para publicar o projeto no **Render** (plano Free) a partir do GitHub.

## 1. GitHub

O código está no repositório privado `Teresa-Mangue/mediagenda`, branch `main`.

Fluxo normal de trabalho depois de alterar código:

```bash
git add -A
git commit -m "descrição da alteração"
git push
```

Se o Render estiver ligado ao repositório, cada `push` para `main` faz **deploy automático**.

## 2. Render

O serviço **já está criado e publicado** em <https://mediagenda-0za9.onrender.com>.
Não é preciso criar outro: um Blueprint com o mesmo nome (`mediagenda`) seria rejeitado
por conflito de nome. O [`render.yaml`](render.yaml) fica como referência da configuração.

Fluxo normal: `git push` para `main` → o Render reconstrói e publica automaticamente.

Configuração aplicada:

| Campo             | Valor                 |
| ----------------- | --------------------- |
| Runtime           | Node                  |
| Plano             | Free                  |
| Região            | Oregon                |
| Build command     | `npm ci --include=dev && npm run build` |
| Start command     | `npm start`           |
| Health check      | `/api/health`         |
| Node              | 24.14.0               |

Para recriar noutra conta/região: **New +** → **Blueprint** → escolhe o repositório →
**Apply**. Aí o URL será diferente.

## 4. Limitações do plano Free

- **Disco efémero**: a base SQLite (`server/data/mediagenda.db`) é recriada em cada
  deploy ou reinício do serviço. Como o `seed` corre no arranque, a aplicação volta
  sempre aos dados de demonstração — perde-se tudo o que for registado na interface.
- **Adormece após ~15 minutos** sem tráfego. O primeiro acesso depois disso demora
  ~50 segundos a responder.
- **750 horas/mês** de instância.

### Persistir a base de dados

Só é possível com um **disco persistente** (planos pagos, a partir de ~7 USD/mês):

1. No serviço do Render: **Disks** → **Add Disk**
   - Name: `mediagenda-data`
   - Mount path: `/var/data`
   - Size: 1 GB
2. Adiciona a variável de ambiente `MEDIAGENDA_DB=/var/data/mediagenda.db`
3. Faz redeploy

Também é possível usar uma base PostgreSQL gerida, mas isso exige alterar a camada de
acesso a dados (`server/src/repositories`), que hoje usa SQLite.

## 5. Verificação pós-deploy

```bash
curl https://mediagenda-0za9.onrender.com/api/health
# {"ok":true,"servico":"MediAgenda API","hora":"..."}
```

Depois abre o URL no browser e entra com uma das contas de demonstração
(ver [README.md](README.md)).
