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

## 2. Render (via Blueprint)

O ficheiro [`render.yaml`](render.yaml) já descreve o serviço.

1. Entra em <https://dashboard.render.com> e escolhe **New +** → **Blueprint**
2. Liga a conta GitHub e autoriza o acesso ao repositório `mediagenda`
3. Seleciona o repositório — o Render lê o `render.yaml` automaticamente
4. Clica **Apply** / **Deploy**

Configuração aplicada:

| Campo             | Valor                 |
| ----------------- | --------------------- |
| Runtime           | Node                  |
| Plano             | Free                  |
| Região            | Frankfurt             |
| Build command     | `npm ci --include=dev && npm run build` |
| Start command     | `npm start`           |
| Health check      | `/api/health`         |
| Node              | 24.14.0               |

O URL final fica no formato `https://mediagenda.onrender.com`.

## 3. Alternativa: criar o serviço à mão

Se preferires não usar o Blueprint: **New +** → **Web Service** → escolhe o repositório e
preenche os mesmos valores da tabela acima, adicionando as variáveis de ambiente
`NODE_VERSION=24.14.0` e `NODE_ENV=production`.

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
curl https://SEU-APP.onrender.com/api/health
# {"ok":true,"servico":"MediAgenda API","hora":"..."}
```

Depois abre o URL no browser e entra com uma das contas de demonstração
(ver [README.md](README.md)).
