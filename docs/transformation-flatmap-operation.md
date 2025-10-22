# Operação FlatMap - Transformation Node

## Descrição

A operação `flatMap` permite transformar cada elemento de um array de objetos usando um template e retorna um array "achatado" (flat) com os resultados. É especialmente útil para reformatar dados de APIs para outros formatos como carousels do WhatsApp.

## Sintaxe

```
Tipo: array
Operação: flatMap
Template: ["string1", "string2", ...]
```

O template deve ser um **array JSON** onde cada string pode conter variáveis no formato `{{nomeVariavel}}`.

## Variáveis no Template

- Use `{{nomeVariavel}}` para acessar campos do objeto
- Suporta **dot notation**: `{{user.name}}`
- Se o campo não existir, será substituído por string vazia
- Se o valor for objeto/array, será convertido para JSON string

## Exemplos Práticos

### Exemplo 1: Transformar Array de Produtos para Carousel

**Entrada:**

```json
[
  {
    "title": "Produto Premium 1",
    "description": "Descrição detalhada do produto 1",
    "imageUrl": "https://exemplo.com/produto1.jpg"
  },
  {
    "title": "Produto Premium 2",
    "description": "Descrição detalhada do produto 2",
    "imageUrl": "https://exemplo.com/produto2.jpg"
  }
]
```

**Template:**

```json
["[{{title}}\n{{description}}]", "{{{imageUrl}}}"]
```

**Saída:**

```json
[
  "[Produto Premium 1\nDescrição detalhada do produto 1]",
  "{https://exemplo.com/produto1.jpg}",
  "[Produto Premium 2\nDescrição detalhada do produto 2]",
  "{https://exemplo.com/produto2.jpg}"
]
```

### Exemplo 2: Criar Lista de Mensagens

**Entrada:**

```json
[
  { "nome": "João", "idade": 30 },
  { "nome": "Maria", "idade": 25 }
]
```

**Template:**

```json
["Nome: {{nome}}", "Idade: {{idade}}", "---"]
```

**Saída:**

```json
["Nome: João", "Idade: 30", "---", "Nome: Maria", "Idade: 25", "---"]
```

### Exemplo 3: Extrair Campos Nested (Dot Notation)

**Entrada:**

```json
[
  {
    "user": {
      "name": "João",
      "email": "joao@exemplo.com"
    },
    "product": {
      "price": 99.9
    }
  }
]
```

**Template:**

```json
[
  "Cliente: {{user.name}}",
  "Email: {{user.email}}",
  "Preço: R$ {{product.price}}"
]
```

**Saída:**

```json
["Cliente: João", "Email: joao@exemplo.com", "Preço: R$ 99.90"]
```

## Uso no Fluxo do Chatbot

### Cenário: API de Produtos → Carousel WhatsApp

1. **HTTP Request Node** (requisição para API)

   - URL: `https://api.exemplo.com/produtos`
   - Salvar em: `produtos_api`

2. **Transformation Node** (extrair array de produtos)

   - Input: `{{produtos_api.data.products}}`
   - Tipo: `array`
   - Operação: `flatMap`
   - Template: `["[{{title}}\n{{description}}]", "{{{imageUrl}}}"]`
   - Salvar em: `carousel_choices`

3. **Message Node** (enviar carousel)
   - Tipo: `interactive_menu`
   - Menu: `carousel`
   - Escolhas: `{{carousel_choices}}`

## Caracteres Especiais

### Quebra de Linha

Use `\n` dentro do template para criar quebras de linha:

```json
["Linha 1\nLinha 2"]
```

### Chaves Literais

- `{valor}` → chaves únicas
- `{{variavel}}` → substituição de variável
- Para chaves literais triplas, use: `{{{variavel}}}`

## Dicas

1. **Sempre use JSON válido** no template
2. **Teste com poucos registros** antes de processar arrays grandes
3. **Combine com outras operações**:
   - Use `filter` antes para filtrar dados
   - Use `deleteKeys` ou `renameKeys` para limpar o array antes

## Comparação com `map`

| Operação  | Entrada              | Saída                                              |
| --------- | -------------------- | -------------------------------------------------- |
| `map`     | Array de N elementos | Array de N elementos transformados                 |
| `flatMap` | Array de N elementos | Array de N × M elementos (M = tamanho do template) |

## Tratamento de Erros

- **Template vazio**: Erro
- **Template não é array JSON**: Erro
- **Variável não existe**: Substituída por string vazia
- **Item não é objeto**: Pulado (não gera saída)

## Exemplo Completo no Flow

```
[DATABASE] → Buscar produtos
  ↓
[TRANSFORMATION] flatMap → Formatar para carousel
  Template: ["[{{nome}}\n{{preco}}]", "{{{imagem}}}"]
  ↓
[MESSAGE] Carousel → Enviar ao usuário
```

## Observações Importantes

- O `flatMap` sempre **multiplica** o número de elementos
- Se você tem 3 objetos e um template com 2 strings, terá 6 elementos no resultado (3 × 2)
- É ideal para criar estruturas repetitivas a partir de dados dinâmicos
