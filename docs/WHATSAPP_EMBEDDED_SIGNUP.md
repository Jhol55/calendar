# WhatsApp Embedded Signup - Custom Flow: Onboarding Business App Users (Coexistence)

## Implementação Completa

Esta implementação segue a documentação oficial do Facebook:
https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/

## Fluxo Completo

### 1. Início do Fluxo

- Usuário cria instância Cloud no formulário
- Sistema gera URL OAuth do Facebook com scopes corretos
- Popup abre com o fluxo do Facebook

### 2. Fluxo do Facebook (Embedded Signup)

O Facebook mostra automaticamente:

1. **Seleção de Configuração**:

   - "Conecte seu app WhatsApp Business existente" (coexistência)
   - "Insira um novo número de telefone do WhatsApp para começar" (novo número)

2. **Se escolher "Conectar existente"**:

   - Inserção de número de telefone
   - QR code aparece
   - Instruções para escanear no WhatsApp Business app

3. **Após escanear QR code**:

   - Usuário escolhe se quer compartilhar histórico
   - Seleção de contas WhatsApp Business (se múltiplas)

4. **Callback**:
   - Facebook redireciona para `/api/whatsapp-official/create-instance-callback`
   - Sistema processa e cria instância

## Arquivos Implementados

### 1. `src/actions/whatsapp-official/embedded-signup.ts`

- `initiateCloudInstanceCreation()`: Inicia o fluxo OAuth
- `processOAuthCallback()`: Processa callback e cria instância
- `exchangeWhatsAppToken()`: Troca código por token (compatibilidade)
- `getWhatsAppOfficialStatus()`: Busca status da conexão
- `disableWhatsAppOfficial()`: Desabilita conexão

### 2. `src/app/api/whatsapp-official/create-instance-callback/route.ts`

- Endpoint GET que recebe callback do Facebook
- Chama `processOAuthCallback()` para processar

### 3. `src/app/api/webhooks/whatsapp-official/route.ts`

- GET: Verificação de webhook (hub.verify_token)
- POST: Recebe eventos do WhatsApp
- Processa campos de coexistência:
  - `history`: Histórico de mensagens
  - `smb_app_state_sync`: Sincronização de contatos
  - `smb_message_echoes`: Mensagens enviadas pelo WhatsApp Business app

### 4. `src/components/features/forms/create-instance/create-instance.tsx`

- Formulário com seleção de provedor (Padrão/Cloud)
- Quando Cloud é selecionado, abre popup com OAuth

## Webhooks de Coexistência

Os seguintes campos são subscritos automaticamente:

```typescript
subscribed_fields: [
  'messages',
  'message_status',
  'message_template_status_update',
  'history', // Histórico de mensagens quando cliente compartilha
  'smb_app_state_sync', // Sincronização de contatos
  'smb_message_echoes', // Mensagens enviadas pelo WhatsApp Business app
];
```

## Configuração Necessária

### Variáveis de Ambiente

```env
FACEBOOK_APP_ID=seu_app_id
FACEBOOK_APP_SECRET=seu_app_secret
NEXT_PUBLIC_FACEBOOK_APP_ID=seu_app_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_token_secreto
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

### Facebook App Dashboard

1. **OAuth Redirect URIs**:

   - Vá em Produtos > Facebook Login > Configurações
   - Adicione: `https://seu-dominio.com/api/whatsapp-official/create-instance-callback`

2. **Webhooks**:
   - Vá em WhatsApp > Configuração
   - URL: `https://seu-dominio.com/api/webhooks/whatsapp-official`
   - Verify Token: (mesmo do `.env`)
   - Subscreva campos: `messages`, `message_status`, `history`, `smb_app_state_sync`, `smb_message_echoes`

## Requisitos da Documentação

✅ **Implementado**:

- OAuth com scopes corretos
- Processamento de callback
- Webhooks de coexistência
- Sincronização de histórico e contatos
- Suporte a mensagens echo do WhatsApp Business app

⚠️ **Requisitos do Facebook**:

- Usuário deve ter WhatsApp Business app versão 2.24.17 ou superior
- Código do país do número deve ser suportado
- Você precisa ser Solution Partner ou Tech Provider (para produção)
- Webhook deve aceitar e processar webhooks corretamente

## Limitações

- Números de coexistência têm throughput fixo de 20 mps
- Países não suportados: Nigéria, África do Sul
- Mensagens enviadas pelo WhatsApp Business app continuam gratuitas
- Mensagens enviadas via API seguem preços do Cloud API

## Próximos Passos

1. Implementar processamento completo de mensagens do histórico (`history`)
2. Implementar sincronização de contatos (`smb_app_state_sync`)
3. Implementar processamento de mensagens echo (`smb_message_echoes`)
4. Integrar com sistema de chatbot/fluxos existente
