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

Crie um arquivo `.env` se quiser usar variaveis de ambiente:

```env
WHATSAPP_TO=5511999999999
WHATSAPP_MESSAGE=Oi, teste
```

## Como executar

Inicia a sessao do WhatsApp e mantem o processo ativo:

```bash
npm start
```

Envia uma mensagem unica:

```bash
npm run send -- 5511999999999 "Mensagem de teste"
```

Ou usando variaveis de ambiente:

```bash
WHATSAPP_TO=5511999999999 WHATSAPP_MESSAGE="Mensagem de teste" npm run send
```

## Deploy com Docker

Build e execucao do servico:

```bash
docker compose up -d --build
```

Enviar uma mensagem usando o container:

```bash
docker compose run --rm whatsapp npm run send -- 5511999999999 "Mensagem de teste"
```

Notas:

- A sessao do WhatsApp fica persistida no volume `whatsapp_session`
- O container usa `chromium` do sistema e nao depende do download do browser do Puppeteer
- Se quiser usar outro binario, ajuste `PUPPETEER_EXECUTABLE_PATH`
