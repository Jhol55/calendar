# Módulo de Webhook

## Visão Geral

O módulo de Webhook permite que seu chatbot receba requisições HTTP externas, similar ao n8n. Isso possibilita integrações com sistemas externos, formulários, APIs de terceiros e muito mais.

## Características

### 🎯 Funcionalidades Principais

- ✅ Suporte a múltiplos métodos HTTP (GET, POST, PUT, PATCH, DELETE)
- ✅ URLs únicas geradas automaticamente para cada webhook
- ✅ Autenticação configurável (None, Basic Auth, Bearer Token)
- ✅ Resposta customizável em JSON
- ✅ Visualização e cópia fácil da URL do webhook
- ✅ Integração completa com o fluxo de chatbot

## Como Usar

### 1. Adicionar o Nó de Webhook

1. Arraste o módulo **Webhook** da barra lateral direita para o canvas
2. Dê um duplo clique no nó para abrir a configuração
3. Configure os parâmetros conforme necessário

### 2. Configuração

#### Campos Disponíveis

**ID do Webhook** (Gerado automaticamente)

- ID único que identifica este webhook
- Usado na URL do webhook

**Descrição** (Opcional)

- Descrição para identificar o propósito do webhook
- Exemplo: "Receber dados do formulário de contato"

**Métodos HTTP Permitidos**

- Selecione quais métodos HTTP o webhook aceitará
- Opções: GET, POST, PUT, PATCH, DELETE
- Pode selecionar múltiplos métodos

**Resposta Padrão (JSON)**

- JSON que será retornado quando o webhook for chamado
- Exemplo:
  ```json
  {
    "status": "success",
    "message": "Dados recebidos com sucesso"
  }
  ```

**Autenticação**

- **Sem autenticação**: Qualquer pessoa pode chamar o webhook
- **Basic Auth**: Requer username e password
- **Bearer Token**: Requer um token de autorização

### 3. Obter a URL do Webhook

Após configurar, a URL do webhook será exibida no próprio nó:

```
https://seu-dominio.com/api/webhooks/wh_1234567890_abc123def
```

Clique no ícone de cópia para copiar a URL.

## Exemplos de Uso

### Exemplo 1: Webhook Simples (POST)

**Configuração:**

- Métodos: POST
- Autenticação: None
- Resposta: `{"status": "ok"}`

**Chamada:**

```bash
curl -X POST https://seu-dominio.com/api/webhooks/wh_xxx \
  -H "Content-Type: application/json" \
  -d '{"nome": "João", "email": "joao@example.com"}'
```

**Resposta:**

```json
{
  "status": "ok"
}
```

### Exemplo 2: Webhook com Basic Auth

**Configuração:**

- Métodos: POST
- Autenticação: Basic Auth
- Username: admin
- Password: secret123

**Chamada:**

```bash
curl -X POST https://seu-dominio.com/api/webhooks/wh_xxx \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWRtaW46c2VjcmV0MTIz" \
  -d '{"data": "sensitive information"}'
```

### Exemplo 3: Webhook com Bearer Token

**Configuração:**

- Métodos: GET, POST
- Autenticação: Bearer Token
- Token: my-secret-token-123

**Chamada:**

```bash
curl -X POST https://seu-dominio.com/api/webhooks/wh_xxx \
  -H "Authorization: Bearer my-secret-token-123" \
  -H "Content-Type: application/json" \
  -d '{"action": "create_user"}'
```

### Exemplo 4: Webhook GET com Query Parameters

**Configuração:**

- Métodos: GET
- Autenticação: None

**Chamada:**

```bash
curl "https://seu-dominio.com/api/webhooks/wh_xxx?name=João&age=25"
```

## Estrutura dos Dados Recebidos

O webhook processa e registra os seguintes dados:

```javascript
{
  webhookId: "wh_xxx",
  method: "POST",
  timestamp: "2025-10-17T10:30:00.000Z",
  queryParams: {
    // Query parameters da URL
  },
  headers: {
    // Cabeçalhos HTTP da requisição
  },
  body: {
    // Corpo da requisição (para POST, PUT, PATCH)
  }
}
```

## Segurança

### Recomendações

1. **Use Autenticação**: Para webhooks públicos, sempre use Basic Auth ou Bearer Token
2. **HTTPS**: Em produção, sempre use HTTPS
3. **Validação**: Valide os dados recebidos antes de processá-los
4. **Rate Limiting**: Considere implementar rate limiting se necessário
5. **Logs**: Monitore os logs de acesso ao webhook

### Autenticação Basic Auth

Para gerar o header de Basic Auth:

```bash
echo -n "username:password" | base64
# Resultado: dXNlcm5hbWU6cGFzc3dvcmQ=
```

Use no header:

```
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

## Casos de Uso

### 1. Integração com Formulários Web

Receba dados de formulários HTML diretamente no seu chatbot flow

### 2. Webhooks de Terceiros

Receba notificações de serviços como Stripe, GitHub, PayPal, etc.

### 3. Integrações com APIs

Conecte seu chatbot com APIs externas que precisam enviar dados

### 4. Automações

Trigger workflows do chatbot a partir de eventos externos

### 5. Sincronização de Dados

Mantenha dados sincronizados entre sistemas diferentes

## Troubleshooting

### Webhook não encontrado (404)

- Verifique se o ID do webhook está correto
- Certifique-se de que o fluxo com o webhook foi salvo

### Unauthorized (401)

- Verifique se você está enviando o header de autorização correto
- Confirme username/password ou token

### Method not allowed (405)

- Verifique se o método HTTP usado está habilitado nas configurações do webhook

## Limitações Atuais

- Os dados recebidos são apenas registrados no console (você pode adicionar lógica para salvar em banco de dados)
- Não há interface para visualizar histórico de chamadas (pode ser implementado)
- Rate limiting não está implementado por padrão

## Próximas Funcionalidades

- [ ] Histórico de chamadas do webhook
- [ ] Retry automático em caso de falha
- [ ] Webhooks assíncronos
- [ ] Transformação de dados recebidos
- [ ] Notificações em caso de erro
- [ ] Dashboard de monitoramento

## Suporte

Para mais informações ou suporte, consulte a documentação principal do projeto.
