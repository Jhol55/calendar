# 🔧 Operações de Array no Node de Transformação

## 📝 Deletar Chaves de Objetos

### Descrição

Remove chaves específicas de cada objeto dentro de um array.

### Configuração

- **Tipo**: Array
- **Operação**: 🗑️ Deletar chaves de objetos
- **Entrada**: Array de objetos (pode ser JSON ou variável)
- **Parâmetro**: Chaves para deletar (separadas por vírgula)

### Exemplo de Uso

#### Entrada

```json
[
  {
    "nome": "João Silva",
    "cpf": "123.456.789-00",
    "idade": 30,
    "email": "joao@exemplo.com",
    "senha": "senha123"
  },
  {
    "nome": "Maria Santos",
    "cpf": "987.654.321-00",
    "idade": 25,
    "email": "maria@exemplo.com",
    "senha": "senha456"
  }
]
```

#### Configuração

- **Chaves para deletar**: `cpf, senha`

#### Saída

```json
[
  {
    "nome": "João Silva",
    "idade": 30,
    "email": "joao@exemplo.com"
  },
  {
    "nome": "Maria Santos",
    "idade": 25,
    "email": "maria@exemplo.com"
  }
]
```

### Casos de Uso Comuns

- Remover dados sensíveis antes de enviar para API externa
- Limpar campos desnecessários para reduzir payload
- Remover metadados internos antes de exibir dados ao usuário

---

## ✏️ Renomear Chaves de Objetos

### Descrição

Renomeia chaves de cada objeto dentro de um array.

### Configuração

- **Tipo**: Array
- **Operação**: ✏️ Renomear chaves de objetos
- **Entrada**: Array de objetos (pode ser JSON ou variável)
- **Parâmetro**: Mapeamento de chaves (formato: `chave_antiga:chave_nova`, separados por vírgula)

### Exemplo de Uso

#### Entrada

```json
[
  {
    "name": "Produto A",
    "value": 100.5,
    "qty": 10,
    "img_url": "https://exemplo.com/imagem1.jpg"
  },
  {
    "name": "Produto B",
    "value": 250.0,
    "qty": 5,
    "img_url": "https://exemplo.com/imagem2.jpg"
  }
]
```

#### Configuração

- **Mapeamento de chaves**: `name:nome, value:preco, qty:quantidade, img_url:imagem`

#### Saída

```json
[
  {
    "nome": "Produto A",
    "preco": 100.5,
    "quantidade": 10,
    "imagem": "https://exemplo.com/imagem1.jpg"
  },
  {
    "nome": "Produto B",
    "preco": 250.0,
    "quantidade": 5,
    "imagem": "https://exemplo.com/imagem2.jpg"
  }
]
```

### Casos de Uso Comuns

- Traduzir nomes de campos de API em inglês para português
- Padronizar nomenclatura entre diferentes APIs
- Adaptar estrutura de dados para templates de mensagem

---

## 🔄 Combinando Operações

Você pode combinar ambas operações em um pipeline de transformações:

### Exemplo: Limpar e Traduzir Dados de API

#### Pipeline

1. **Transformação 1 (Array - Deletar chaves)**

   - Entrada: `{{$nodes.api_node.output.data}}`
   - Chaves para deletar: `_id, __v, createdAt, updatedAt`

2. **Transformação 2 (Array - Renomear chaves)**
   - Entrada: `{{$node.output}}` (saída da transformação anterior)
   - Mapeamento: `name:nome, price:preco, description:descricao`

#### Entrada Original

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Notebook",
    "price": 3500,
    "description": "Notebook 15 polegadas",
    "__v": 0,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-02T00:00:00Z"
  }
]
```

#### Saída Final

```json
[
  {
    "nome": "Notebook",
    "preco": 3500,
    "descricao": "Notebook 15 polegadas"
  }
]
```

---

## 💡 Dicas e Boas Práticas

### 1. Ordem das Operações

Sempre delete chaves **antes** de renomear, pois se você renomear primeiro e depois tentar deletar pelo nome antigo, a operação não funcionará.

### 2. Formato de Entrada

Ambas operações aceitam:

- Array JavaScript direto
- String JSON (será parseado automaticamente)
- Variáveis dinâmicas: `{{$nodes.nodeId.output.campo}}`
- Saída de outras transformações: `{{$node.output}}`

### 3. Validação de Entrada

- Se o input não for um array de objetos, os itens serão retornados sem modificação
- Chaves inexistentes na operação de delete são ignoradas
- Chaves não especificadas no rename mantêm seus nomes originais

### 4. Uso com Variáveis

Você pode usar variáveis dinâmicas nos parâmetros:

```
Chaves para deletar: {{$node.input.campos_sensiveis}}
Mapeamento de chaves: {{$node.input.traducao_campos}}
```

### 5. Espaços em Branco

Os espaços em branco ao redor de vírgulas e dois-pontos são automaticamente removidos:

```
✅ Correto: "campo1, campo2, campo3"
✅ Também correto: "campo1,campo2,campo3"
✅ Também correto: " campo1 , campo2 , campo3 "
```

---

## 🚨 Tratamento de Erros

### Deletar Chaves

- **Erro**: "Nenhuma chave para deletar foi especificada"
  - **Causa**: Parâmetro vazio ou só com espaços
  - **Solução**: Adicione pelo menos uma chave válida

### Renomear Chaves

- **Erro**: "Nenhum mapeamento de chaves foi especificado"

  - **Causa**: Parâmetro vazio ou só com espaços
  - **Solução**: Adicione pelo menos um mapeamento válido

- **Erro**: "Mapeamento inválido: X. Use o formato 'chave_antiga:chave_nova'"
  - **Causa**: Formato incorreto do mapeamento
  - **Solução**: Certifique-se de usar o formato `antiga:nova`

### Ambas Operações

- **Erro**: "Input deve ser um array ou string JSON válida"
  - **Causa**: Input não é um array válido
  - **Solução**: Verifique se a entrada é um array JSON válido

---

## 📊 Exemplos Práticos

### Exemplo 1: Remover Campos de Auditoria

```
Entrada: {{$nodes.database_node.output.records}}
Operação: Deletar chaves
Chaves: _createdAt, _updatedAt, _version
```

### Exemplo 2: Traduzir Resposta de API Externa

```
Entrada: {{$nodes.http_request.output.response.items}}
Operação: Renomear chaves
Mapeamento: firstName:nome, lastName:sobrenome, email:emailContato
```

### Exemplo 3: Preparar Dados para Carrossel

```
Pipeline:
1. Deletar: __metadata, internalId, debug
2. Renomear: title:titulo, description:descricao, imageUrl:imagem, price:preco
```

---

## 🎯 Casos de Uso Reais

### E-commerce

- Remover preços de custo antes de enviar para cliente
- Renomear campos de produto para português
- Limpar metadados de estoque

### CRM/Gestão

- Remover dados sensíveis (CPF, RG) antes de exportar
- Padronizar nomenclatura entre sistemas
- Adaptar estrutura para integrações

### Chatbot

- Limpar dados antes de enviar em mensagem
- Traduzir campos de APIs externas
- Preparar dados para templates de mensagem
