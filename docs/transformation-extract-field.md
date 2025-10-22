# 📤 Extrair Campo de Arrays - Node de Transformação

## 📝 Descrição

A operação `extractField` permite criar um novo array extraindo um campo específico de cada elemento de um array de objetos, ou um índice específico de arrays aninhados.

## ⚙️ Configuração

- **Tipo**: Array
- **Operação**: 📤 Extrair campo de objetos
- **Entrada**: Array de objetos ou arrays (pode ser JSON ou variável)
- **Parâmetro**: Nome do campo ou índice

## 🎯 Casos de Uso

### 1. Extrair Campo de Array de Objetos

#### Entrada

```json
[
  { "nome": "João Silva", "idade": 30, "cidade": "São Paulo" },
  { "nome": "Maria Santos", "idade": 25, "cidade": "Rio de Janeiro" },
  { "nome": "Pedro Costa", "idade": 35, "cidade": "Belo Horizonte" }
]
```

#### Configuração

- **Nome do campo**: `nome`

#### Saída

```json
["João Silva", "Maria Santos", "Pedro Costa"]
```

---

### 2. Extrair Campo Aninhado (Dot Notation)

#### Entrada

```json
[
  {
    "id": 1,
    "user": {
      "name": "João",
      "email": "joao@exemplo.com"
    }
  },
  {
    "id": 2,
    "user": {
      "name": "Maria",
      "email": "maria@exemplo.com"
    }
  }
]
```

#### Configuração

- **Nome do campo**: `user.name`

#### Saída

```json
["João", "Maria"]
```

---

### 3. Extrair Índice de Arrays Aninhados

#### Entrada

```json
[
  ["a", "b", "c"],
  ["d", "e", "f"],
  ["g", "h", "i"]
]
```

#### Configuração

- **Nome do campo**: `0` (primeiro elemento)

#### Saída

```json
["a", "d", "g"]
```

---

### 4. Extrair Múltiplos Níveis

#### Entrada

```json
[
  {
    "produto": {
      "detalhes": {
        "preco": 100.5,
        "nome": "Notebook"
      }
    }
  },
  {
    "produto": {
      "detalhes": {
        "preco": 250.0,
        "nome": "Monitor"
      }
    }
  }
]
```

#### Configuração

- **Nome do campo**: `produto.detalhes.preco`

#### Saída

```json
[100.5, 250.0]
```

---

## 🔄 Casos de Uso Práticos

### Exemplo 1: Criar Lista de Nomes para Mensagem

**Objetivo**: Transformar dados de usuários em lista de nomes

**Pipeline**:

1. **Entrada**: `{{$nodes.database_node.output.records}}`
2. **Operação**: Extrair campo
3. **Campo**: `nome`

**Entrada**:

```json
[
  { "id": 1, "nome": "João", "status": "ativo" },
  { "id": 2, "nome": "Maria", "status": "ativo" },
  { "id": 3, "nome": "Pedro", "status": "inativo" }
]
```

**Saída**:

```json
["João", "Maria", "Pedro"]
```

**Uso**: Pode depois usar `join` para criar: "João, Maria, Pedro"

---

### Exemplo 2: Extrair IDs para Outra Operação

**Objetivo**: Pegar só os IDs dos produtos em estoque

**Pipeline**:

1. **Transformação 1** (Array - Filter): Filtrar produtos com `estoque > 0`
2. **Transformação 2** (Array - Extrair campo): Campo `id`

**Entrada Original**:

```json
[
  { "id": 101, "nome": "Produto A", "estoque": 10 },
  { "id": 102, "nome": "Produto B", "estoque": 0 },
  { "id": 103, "nome": "Produto C", "estoque": 5 }
]
```

**Saída Final**:

```json
[101, 103]
```

---

### Exemplo 3: Extrair Emails de Usuários Aninhados

**Objetivo**: Criar lista de emails de contatos aninhados

**Entrada**:

```json
[
  {
    "empresa": "Empresa A",
    "contato": {
      "nome": "João",
      "email": "joao@empresaa.com"
    }
  },
  {
    "empresa": "Empresa B",
    "contato": {
      "nome": "Maria",
      "email": "maria@empresab.com"
    }
  }
]
```

**Configuração**:

- **Campo**: `contato.email`

**Saída**:

```json
["joao@empresaa.com", "maria@empresab.com"]
```

---

### Exemplo 4: Pipeline Completo para Carrossel

**Objetivo**: Preparar dados de produtos para carrossel do WhatsApp

**Dados Originais**:

```json
[
  {
    "_id": "123",
    "produto": {
      "nome": "Notebook",
      "preco": 3500,
      "imagem": "https://exemplo.com/img1.jpg"
    },
    "__v": 0
  },
  {
    "_id": "456",
    "produto": {
      "nome": "Mouse",
      "preco": 50,
      "imagem": "https://exemplo.com/img2.jpg"
    },
    "__v": 0
  }
]
```

**Pipeline**:

1. **Deletar chaves**: `_id, __v`
2. **Extrair campo**: `produto`
3. **Renomear chaves**: `nome:title, imagem:imageUrl, preco:price`

**Saída Final**:

```json
[
  {
    "title": "Notebook",
    "price": 3500,
    "imageUrl": "https://exemplo.com/img1.jpg"
  },
  {
    "title": "Mouse",
    "price": 50,
    "imageUrl": "https://exemplo.com/img2.jpg"
  }
]
```

---

## 💡 Recursos Avançados

### Dot Notation (Campos Aninhados)

A operação suporta dot notation para acessar campos aninhados:

```
user.profile.name
produto.detalhes.preco
config.api.endpoint
```

### Índices Numéricos

Para arrays de arrays, use índices numéricos:

```
0  - Primeiro elemento
1  - Segundo elemento
2  - Terceiro elemento
```

### Valores Nulos

Se um campo não existir em algum objeto, será retornado `null`:

**Entrada**:

```json
[
  { "nome": "João", "email": "joao@email.com" },
  { "nome": "Maria" },
  { "nome": "Pedro", "email": "pedro@email.com" }
]
```

**Campo**: `email`

**Saída**:

```json
["joao@email.com", null, "pedro@email.com"]
```

---

## 🔗 Combinando com Outras Operações

### Extrair e Juntar em String

```
Pipeline:
1. Extrair campo: "nome"
2. Join: ", "

Entrada: [{"nome": "João"}, {"nome": "Maria"}]
Saída: "João, Maria"
```

### Extrair e Contar

```
Pipeline:
1. Extrair campo: "preco"
2. Sum

Entrada: [{"preco": 100}, {"preco": 200}]
Saída: 300
```

### Extrair e Remover Duplicados

```
Pipeline:
1. Extrair campo: "categoria"
2. Unique

Entrada: [{"categoria": "A"}, {"categoria": "B"}, {"categoria": "A"}]
Saída: ["A", "B"]
```

---

## 🚨 Tratamento de Erros

### Erro: "Nome do campo ou índice não especificado"

- **Causa**: Parâmetro vazio
- **Solução**: Forneça um nome de campo ou índice válido

### Resultado: Array com `null`

- **Causa**: Campo não existe em alguns objetos
- **Solução**: Isso é normal. Use `filter` depois se quiser remover nulls

### Resultado: Array vazio

- **Causa**: Input não é um array ou está vazio
- **Solução**: Verifique a entrada da transformação

---

## 📊 Comparação com Outras Operações

| Operação         | O que faz                          | Quando usar                                   |
| ---------------- | ---------------------------------- | --------------------------------------------- |
| **extractField** | Cria array com valores de um campo | Quando quer só uma propriedade de cada objeto |
| **deleteKeys**   | Remove campos de objetos           | Quando quer remover dados sensíveis           |
| **renameKeys**   | Renomeia campos                    | Quando quer padronizar nomenclatura           |
| **map**          | Transforma cada elemento           | Quando quer transformação complexa            |
| **filter**       | Filtra elementos                   | Quando quer só alguns elementos               |

---

## ✨ Dicas de Uso

1. **Use com Database Node**: Perfeito para extrair campos de resultados de consultas
2. **Combine com Join**: Extrair + Join = criar lista formatada
3. **Use Dot Notation**: Acesse campos profundamente aninhados sem múltiplas transformações
4. **Crie Pipelines**: Combine com outras operações para transformações complexas
5. **Teste com JSON**: Cole JSON de exemplo para verificar o resultado antes de usar variáveis

---

## 🎓 Exemplos do Mundo Real

### CRM: Exportar Emails

```
Input: Lista de contatos do banco
extractField: "email"
Output: Array de emails para envio
```

### E-commerce: Calcular Total

```
Pipeline:
1. extractField: "preco"
2. sum
Output: Total do carrinho
```

### Chatbot: Criar Menu

```
Pipeline:
1. extractField: "nome"
2. join: "\n- "
Output: "- Produto A\n- Produto B\n- Produto C"
```

### Dashboard: Listar Categorias Únicas

```
Pipeline:
1. extractField: "categoria"
2. unique
3. join: ", "
Output: "Eletrônicos, Roupas, Livros"
```
