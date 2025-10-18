# Sistema de Variáveis Dinâmicas

## Visão Geral

O sistema de variáveis dinâmicas permite usar dados de execuções anteriores nos nós do fluxo, similar ao n8n. Você pode referenciar dados recebidos pelo webhook ou saídas de outros nós.

## Como Usar

### 1. Acessar o Painel de Execuções

Quando você abre a configuração de um nó (duplo clique), um painel lateral aparece à esquerda mostrando:

- **Aba "Entrada"**: Dados recebidos pelo nó (do webhook ou nó anterior)
- **Aba "Saída"**: Resultado da execução do nó

### 2. Copiar Variáveis

1. Navegue pelos dados no painel de execuções
2. Clique no ícone de **cópia** ao lado do valor desejado
3. A variável é copiada no formato `{{$node.input.caminho.para.valor}}`
4. Cole no campo desejado (número, mensagem, etc.)

### 3. Sintaxe de Variáveis

```
{{$node.input.campo}}           # Acessa campo da entrada
{{$node.input.body.nome}}       # Acessa campo aninhado
{{$node.webhook.body.email}}    # Acessa dados do webhook
{{$node.webhook.headers.token}} # Acessa headers do webhook
```

## Exemplos Práticos

### Exemplo 1: Saudar usuário pelo nome

**Webhook recebe:**

```json
{
  "nome": "João",
  "email": "joao@exemplo.com"
}
```

**Configuração da mensagem:**

```
Olá {{$node.input.nome}}, seja bem-vindo!
```

**Resultado enviado:**

```
Olá João, seja bem-vindo!
```

### Exemplo 2: Número dinâmico

**Webhook recebe:**

```json
{
  "cliente": {
    "nome": "Maria",
    "telefone": "5511999999999"
  }
}
```

**Configuração:**

- **Número**: `{{$node.input.cliente.telefone}}`
- **Mensagem**: `Olá {{$node.input.cliente.nome}}!`

**Resultado:**

- Envia para: `5511999999999`
- Mensagem: `Olá Maria!`

### Exemplo 3: Dados do Webhook

**Headers recebidos:**

```json
{
  "x-user-id": "12345",
  "authorization": "Bearer token..."
}
```

**Configuração da mensagem:**

```
Seu ID de usuário é: {{$node.webhook.headers.x-user-id}}
```

**Resultado:**

```
Seu ID de usuário é: 12345
```

## Contexto de Variáveis

O sistema fornece os seguintes contextos:

### `$node.input`

Dados recebidos pelo nó atual (do webhook ou nó anterior)

### `$node.webhook`

Dados originais do webhook que iniciou o fluxo:

- `$node.webhook.body` - Corpo da requisição
- `$node.webhook.headers` - Headers HTTP
- `$node.webhook.queryParams` - Parâmetros da URL

### `$node.output`

Resultado da execução do nó (disponível na aba "Saída")

## Campos que Suportam Variáveis

### Nó de Mensagem

- ✅ **Número de telefone**: `{{$node.input.phone}}`
- ✅ **Texto da mensagem**: `Olá {{$node.input.name}}!`
- ✅ **URL de mídia**: `{{$node.input.imageUrl}}`
- ✅ **Legenda**: `Foto de {{$node.input.user}}`
- ✅ **Nome do contato**: `{{$node.input.contactName}}`
- ✅ **Telefone do contato**: `{{$node.input.contactPhone}}`

## Resolução de Variáveis

As variáveis são resolvidas **no momento da execução** pelo worker:

1. **Webhook recebe dados** → Armazena em `webhookData.body`
2. **Nó é processado** → Worker substitui variáveis
3. **Mensagem é enviada** → Com valores reais

### Exemplo de Resolução

```javascript
// Configuração do nó
{
  phoneNumber: "{{$node.input.cliente.telefone}}",
  text: "Olá {{$node.input.cliente.nome}}!"
}

// Dados recebidos
{
  cliente: {
    nome: "João",
    telefone: "5511999999999"
  }
}

// Após resolução
{
  phoneNumber: "5511999999999",
  text: "Olá João!"
}
```

## Tratamento de Erros

### Variável não encontrada

Se uma variável não existir no contexto, ela permanece sem substituição:

```
Entrada: "Olá {{$node.input.nomeInexistente}}!"
Saída:   "Olá {{$node.input.nomeInexistente}}!"
```

### Valor nulo ou undefined

Valores nulos são mantidos como a variável original:

```
Entrada: "Status: {{$node.input.status}}"
Se status = null
Saída:   "Status: {{$node.input.status}}"
```

## Dicas e Boas Práticas

### ✅ Faça

- Use variáveis para personalizar mensagens
- Teste o fluxo com dados reais primeiro
- Verifique os dados no painel antes de usar
- Use paths completos: `{{$node.input.user.name}}`

### ❌ Evite

- Não use variáveis em campos críticos sem validação
- Não assuma que dados sempre existirão
- Não use paths incorretos

## Casos de Uso

### 1. Sistema de Notificações

```
Webhook recebe pedido → Envia confirmação com dados do pedido
"Seu pedido #{{$node.input.orderId}} foi confirmado!"
```

### 2. Chatbot com Contexto

```
Webhook recebe nome do usuário → Personaliza atendimento
"Olá {{$node.input.name}}, como posso ajudar?"
```

### 3. Integração com CRM

```
Webhook recebe dados do lead → Envia mensagem personalizada
"Olá {{$node.input.lead.name}}, vi que você se interessou por {{$node.input.product}}!"
```

### 4. Sistema de Alertas

```
Webhook recebe alerta → Notifica com detalhes
"⚠️ Alerta: {{$node.input.alertType}} em {{$node.input.location}}"
```

## Próximas Funcionalidades

- [ ] Variáveis com transformações (`uppercase`, `lowercase`)
- [ ] Operadores condicionais (`if-else`)
- [ ] Funções de formatação (`date`, `currency`)
- [ ] Referência a outros nós (`$node.message_1.output`)
- [ ] Variáveis de ambiente
- [ ] Concatenação de variáveis

## Suporte

Para mais informações sobre como usar o sistema de variáveis, consulte:

- Documentação do Webhook: `docs/webhook-module.md`
- Documentação do Sistema de Filas: `docs/queue-system.md`
