# Salgados WhatsApp

Servico Node para conectar ao WhatsApp Web e enviar mensagens.

## Requisitos

- Node.js 18 ou superior
- Uma conta WhatsApp ativa para autenticar o QR code

## Instalacao

```bash
npm install
```

## Configuracao

Crie um arquivo `.env` com este formato:

```env
PORT=3000
WHATSAPP_INTERNAL_TOKEN=trocar-este-token
WHATSAPP_API_URL=http://127.0.0.1:3000
WHATSAPP_BACKEND_URL=http://127.0.0.1:8000/api/v1/webhooks/whatsapp/messages
WHATSAPP_TO=5511999999999
WHATSAPP_MESSAGE=Oi, teste
```

Esse arquivo é opcional. O `docker-compose.yml` não depende dele para subir; ele é usado para definir porta, token interno e variáveis do envio manual.

### Hosts do Docker

Quando os serviços estiverem na rede compartilhada `salgados_backend_net`, use estes hosts internos:

- Do Laravel no container `salgados-app` para o WhatsApp: `http://salgados-whatsapp:3000`
- Do WhatsApp no container `salgados-whatsapp` para o backend: `http://nginx/api/v1/webhooks/whatsapp/messages`

Isso significa que:

- O backend Laravel deve usar `WHATSAPP_BASE_URL=http://salgados-whatsapp:3000`
- O serviço Node deve usar `WHATSAPP_BACKEND_URL=http://nginx/api/v1/webhooks/whatsapp/messages`

No uso local, você pode manter `127.0.0.1` nas variáveis acima enquanto os containers expõem as portas para a máquina host.

## Como executar

Inicia a sessao do WhatsApp e mantem o processo ativo:

```bash
npm start
```

Envia uma mensagem unica localmente:

```bash
npm run send -- 5511999999999 "Mensagem de teste"
```

Ou usando variaveis de ambiente:

```bash
WHATSAPP_TO=5511999999999 WHATSAPP_MESSAGE="Mensagem de teste" npm run send
```

Se `WHATSAPP_API_URL` estiver definido, o comando `send` chama o endpoint HTTP em vez de abrir um segundo Chromium.

## Endpoint HTTP

O servico expõe:

- `GET /health`
- `POST /send`

Quando `WHATSAPP_BACKEND_URL` estiver definido, mensagens recebidas no WhatsApp são enviadas para o backend e entram na fila interna como itens `received`.

Exemplo de chamada:

```bash
curl -X POST http://127.0.0.1:3000/send \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: trocar-este-token" \
  -d '{"to":"351911928481","message":"Mensagem de teste"}'
```

O payload aceita:

- `to`
- `recipient`
- `phone`
- `message`
- `text`

## Deploy com Docker

```bash
docker compose up -d --build
```

O volume `whatsapp_session` preserva a sessão autenticada entre reinicios.

Para reiniciar o serviço, use o menu interativo:

```bash
./deploy.sh
```

O script mostra opções para limpar a sessão ou manter a sessão atual antes de subir o container.
