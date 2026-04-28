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
WHATSAPP_TO=5511999999999
WHATSAPP_MESSAGE=Oi, teste
```

Esse arquivo é opcional. O `docker-compose.yml` não depende dele para subir; ele é usado para definir porta, token interno e variáveis do envio manual.

Quando o serviço estiver no Docker e ligado à rede compartilhada `salgados_backend_net`, o Laravel deve apontar para:

```env
WHATSAPP_BASE_URL=http://salgados-whatsapp:3000
```

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
