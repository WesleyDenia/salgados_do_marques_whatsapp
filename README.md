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

Esse arquivo é opcional. O `docker-compose.yml` do serviço não depende dele para subir; ele só é útil se você quiser passar `WHATSAPP_TO` e `WHATSAPP_MESSAGE` como variáveis locais no comando `npm run send`.

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
