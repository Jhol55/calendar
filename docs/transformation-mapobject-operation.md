# Operação MapObject - Transformation Node

## Descrição

A operação `mapObject` permite transformar cada elemento de um array em um novo objeto usando um template JSON completo. É perfeita para reformatar dados de APIs em estruturas complexas como carousels do WhatsApp com botões, cards, etc.

## Sintaxe

```
Tipo: array
Operação: mapObject
Template de objeto JSON: {"campo1": "{{var1}}", "campo2": {...}, ...}
```

O template deve ser um **objeto JSON válido** onde você pode usar:

- Strings com variáveis `{{nomeVariavel}}`
- Objetos aninhados
- Arrays
- Valores fixos (strings, números, booleans)

## Variáveis no Template

- Use `{{nomeVariavel}}` para acessar campos do objeto de origem
- Suporta **dot notation**: `{{user.name}}`
- Se o campo não existir, será substituído por string vazia
- Se o valor for objeto/array, será convertido para JSON string

## Exemplo Principal: API → Carousel WhatsApp

### Entrada (da API)

```json
[
  {
    "_id": "402fbec3-22d9-4c63-a899-d9b42241c45f",
    "nome": "Felca - Reeducação Alimentar 21 Dias",
    "valor": "1.174,74",
    "quantidade": "42",
    "link_cardapio": "https://exemplo.com/img1.jpg",
    "link_tabela_nutricional": "https://exemplo.com/tabela1.jpg"
  },
  {
    "_id": "3a54c3b4-63c6-4fd5-930b-86d186e41b5a",
    "nome": "Felca - Reeducação Alimentar 14 Dias",
    "valor": "391,58",
    "quantidade": "14",
    "link_cardapio": "https://exemplo.com/img2.jpg",
    "link_tabela_nutricional": "https://exemplo.com/tabela2.jpg"
  }
]
```

### Template

```json
{
  "id": "{{_id}}",
  "title": "{{nome}}",
  "description": "💰 R$ {{valor}} | 📦 {{quantidade}} unidades",
  "imageUrl": "{{link_cardapio}}",
  "buttons": [
    {
      "text": "🛒 Comprar",
      "id": "{{nome}}",
      "description": "",
      "actionType": "return_id"
    },
    {
      "text": "📋 Ver Cardápio",
      "id": "{{link_cardapio}}",
      "description": "",
      "actionType": "link"
    },
    {
      "text": "📊 Tabela Nutricional",
      "id": "{{link_tabela_nutricional}}",
      "description": "",
      "actionType": "link"
    }
  ]
}
```

### Saída (formato carousel)

```json
[
  {
    "id": "402fbec3-22d9-4c63-a899-d9b42241c45f",
    "title": "Felca - Reeducação Alimentar 21 Dias",
    "description": "💰 R$ 1.174,74 | 📦 42 unidades",
    "imageUrl": "https://exemplo.com/img1.jpg",
    "buttons": [
      {
        "text": "🛒 Comprar",
        "id": "Felca - Reeducação Alimentar 21 Dias",
        "description": "",
        "actionType": "return_id"
      },
      {
        "text": "📋 Ver Cardápio",
        "id": "https://exemplo.com/img1.jpg",
        "description": "",
        "actionType": "link"
      },
      {
        "text": "📊 Tabela Nutricional",
        "id": "https://exemplo.com/tabela1.jpg",
        "description": "",
        "actionType": "link"
      }
    ]
  },
  {
    "id": "3a54c3b4-63c6-4fd5-930b-86d186e41b5a",
    "title": "Felca - Reeducação Alimentar 14 Dias",
    "description": "💰 R$ 391,58 | 📦 14 unidades",
    "imageUrl": "https://exemplo.com/img2.jpg",
    "buttons": [
      {
        "text": "🛒 Comprar",
        "id": "Felca - Reeducação Alimentar 14 Dias",
        "description": "",
        "actionType": "return_id"
      },
      {
        "text": "📋 Ver Cardápio",
        "id": "https://exemplo.com/img2.jpg",
        "description": "",
        "actionType": "link"
      },
      {
        "text": "📊 Tabela Nutricional",
        "id": "https://exemplo.com/tabela2.jpg",
        "description": "",
        "actionType": "link"
      }
    ]
  }
]
```

## Uso no Fluxo do Chatbot

### Cenário Completo: API de Produtos → Carousel WhatsApp

#### 1. HTTP Request Node

- **URL:** `https://api.exemplo.com/produtos`
- **Método:** `GET`
- **Salvar em:** `produtos_api`

#### 2. Transformation Node

- **Input:** `{{produtos_api}}`
- **Tipo:** `array`
- **Operação:** `🎨 Transformar em Objeto (mapObject)`
- **Template de objeto JSON:** (cole o template acima)
- **Salvar em:** `carousel_produtos`

#### 3. Message Node

- **Tipo:** `Menu Interativo`
- **Submenu:** `Carousel`
- **Modo:** `JSON`
- **JSON:** `{{carousel_produtos}}` ← Cole apenas a variável!

**✨ Novidade:** O campo JSON agora aceita variáveis dinâmicas!

- ✅ **Variável**: `{{carousel_produtos}}` (recomendado - usa resultado do transformation)
- ✅ **JSON literal**: Cole o array completo diretamente
- ℹ️ O sistema detecta automaticamente se é variável ou JSON literal

## Exemplos Adicionais

### Exemplo 1: Template Simples

**Entrada:**

```json
[
  { "nome": "João", "idade": 30, "cidade": "São Paulo" },
  { "nome": "Maria", "idade": 25, "cidade": "Rio de Janeiro" }
]
```

**Template:**

```json
{
  "fullName": "{{nome}}",
  "info": "{{idade}} anos - {{cidade}}"
}
```

**Saída:**

```json
[
  { "fullName": "João", "info": "30 anos - São Paulo" },
  { "fullName": "Maria", "info": "25 anos - Rio de Janeiro" }
]
```

### Exemplo 2: Objetos Aninhados com Dot Notation

**Entrada:**

```json
[
  {
    "user": {
      "name": "João",
      "contact": {
        "email": "joao@exemplo.com"
      }
    },
    "status": "active"
  }
]
```

**Template:**

```json
{
  "userName": "{{user.name}}",
  "userEmail": "{{user.contact.email}}",
  "isActive": "{{status}}"
}
```

**Saída:**

```json
[
  {
    "userName": "João",
    "userEmail": "joao@exemplo.com",
    "isActive": "active"
  }
]
```

### Exemplo 3: Arrays Dinâmicos no Template

**Entrada:**

```json
[
  { "produto": "Item A", "preco": "100", "link": "http://a.com" },
  { "produto": "Item B", "preco": "200", "link": "http://b.com" }
]
```

**Template:**

```json
{
  "title": "{{produto}}",
  "actions": [
    { "type": "buy", "value": "{{produto}}" },
    { "type": "view", "url": "{{link}}" }
  ],
  "metadata": {
    "price": "{{preco}}",
    "available": true
  }
}
```

**Saída:**

```json
[
  {
    "title": "Item A",
    "actions": [
      { "type": "buy", "value": "Item A" },
      { "type": "view", "url": "http://a.com" }
    ],
    "metadata": {
      "price": "100",
      "available": true
    }
  },
  {
    "title": "Item B",
    "actions": [
      { "type": "buy", "value": "Item B" },
      { "type": "view", "url": "http://b.com" }
    ],
    "metadata": {
      "price": "200",
      "available": true
    }
  }
]
```

## Recursos Avançados

### 1. Valores Fixos

Você pode misturar variáveis com valores fixos:

```json
{
  "type": "product",
  "name": "{{nome}}",
  "version": 2,
  "active": true
}
```

### 2. Arrays de Botões Dinâmicos

Perfeito para carousels:

```json
{
  "id": "{{_id}}",
  "title": "{{nome}}",
  "buttons": [
    {
      "text": "Comprar",
      "id": "buy_{{_id}}",
      "actionType": "return_id"
    },
    {
      "text": "Ver Mais",
      "id": "{{link}}",
      "actionType": "link"
    }
  ]
}
```

### 3. Strings Vazias para Campos Opcionais

Se um campo não existir no objeto de origem, será substituído por `""`:

```json
{
  "required": "{{nome}}",
  "optional": "{{campo_que_nao_existe}}"
}

// Resultado: {"required": "João", "optional": ""}
```

## Diferença entre `map` e `mapObject`

| Operação    | Uso                           | Exemplo                               |
| ----------- | ----------------------------- | ------------------------------------- |
| `map`       | Transformação simples (texto) | `"Nome: {{nome}}"`                    |
| `mapObject` | Criação de objetos complexos  | `{"id": "{{_id}}", "buttons": [...]}` |

## Tratamento de Erros

- **Template vazio**: Erro
- **Template não é JSON válido**: Erro com mensagem explicativa
- **Variável não existe**: Substituída por string vazia
- **Item não é objeto**: Retorna objeto vazio `{}`

## Dicas de Uso

1. **Valide seu JSON**: Use um validador JSON antes de colar no template
2. **Teste com poucos dados**: Comece com 1-2 itens do array
3. **Use dot notation**: Para acessar campos nested (`{{user.name}}`)
4. **Combine operações**:
   - Use `filter` antes para filtrar dados
   - Use `deleteKeys` para remover campos desnecessários antes
   - Use `mapObject` para criar a estrutura final

## Template para Carousel WhatsApp (Completo)

```json
{
  "id": "{{_id}}",
  "title": "{{nome}}",
  "description": "{{descricao}}",
  "imageUrl": "{{imagem}}",
  "buttons": [
    {
      "text": "🛒 Comprar",
      "id": "{{nome}}",
      "description": "",
      "actionType": "return_id"
    },
    {
      "text": "🔗 Ver Mais",
      "id": "{{link}}",
      "description": "",
      "actionType": "link"
    },
    {
      "text": "📞 Ligar",
      "id": "{{telefone}}",
      "description": "",
      "actionType": "call"
    }
  ]
}
```

## Fluxo Completo Exemplo

```
[HTTP REQUEST] → Buscar produtos da API
  ↓ Salvar em: produtos_api

[TRANSFORMATION] deleteKeys → Limpar campos desnecessários
  Input: {{produtos_api}}
  Chaves para deletar: _createdAt, _updatedAt, peso_min, peso_max
  ↓ Salvar em: produtos_limpos

[TRANSFORMATION] mapObject → Formatar para carousel
  Input: {{produtos_limpos}}
  Template: {...template carousel...}
  ↓ Salvar em: carousel_produtos

[MESSAGE] Carousel → Enviar ao usuário
  Modo: JSON
  JSON: {{carousel_produtos}}
```

## Observações Importantes

- O `mapObject` sempre retorna um **array de objetos**
- Cada item do array de entrada gera **um objeto** no array de saída
- O template é aplicado **independentemente** para cada item
- Suporta qualquer profundidade de objetos/arrays aninhados
