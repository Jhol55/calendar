# 📋 Gerenciamento de Flows Temporários

## 🎯 Problema Resolvido

Antes, cada vez que um usuário executava um workflow sem salvar, criava múltiplos flows temporários no banco, causando poluição:

- `[TEMP] flow1`, `[TEMP] flow2`, `[TEMP] flow3`...
- Banco ficava com centenas de registros desnecessários

## ✅ Solução Implementada

### 1. **Coluna `isTemporary`** no Schema

```prisma
model chatbot_flows {
  // ... outros campos
  isTemporary Boolean   @default(false)

  @@index([isTemporary])
}
```

### 2. **Estratégia: 1 Flow Temporário por Usuário**

Ao invés de criar múltiplos flows, **reutiliza sempre o mesmo**:

```typescript
// Buscar flow temporário existente do usuário
const existingTempFlow = await prisma.chatbot_flows.findFirst({
  where: {
    userId: currentUserId,
    isTemporary: true, // Flag segura
  },
});

if (existingTempFlow) {
  // Atualiza o existente
  await prisma.chatbot_flows.update({
    where: { id: existingTempFlow.id },
    data: { nodes, edges, updatedAt: new Date() },
  });
} else {
  // Cria novo (só uma vez)
  await prisma.chatbot_flows.create({
    data: {
      name: `Preview - User ${currentUserId}`,
      isTemporary: true,
      isActive: false,
      // ...
    },
  });
}
```

### 3. **Script de Limpeza Automática**

**Arquivo:** `scripts/cleanup-temp-flows.js`

Remove flows temporários com mais de 24 horas:

```javascript
const oldTempFlows = await prisma.chatbot_flows.findMany({
  where: {
    isTemporary: true, // ✅ Seguro - não afeta flows normais
    updatedAt: { lt: oneDayAgo },
  },
});
```

**Comando:**

```bash
npm run cleanup:temp-flows
```

### 4. **API Endpoint para Limpeza**

**Endpoint:** `GET /api/admin/cleanup-temp-flows`

Retorna:

```json
{
  "success": true,
  "deleted": {
    "flows": 5,
    "executions": 23
  }
}
```

## 📊 Comparação

### Antes:

```
User 1: 50 flows temporários
User 2: 30 flows temporários
User 3: 20 flows temporários
Total: 100+ registros 💥
```

### Agora:

```
User 1: 1 flow temporário (reutilizado)
User 2: 1 flow temporário (reutilizado)
User 3: 1 flow temporário (reutilizado)
Total: 3 registros ✅
```

## 🚀 Uso

### Executar Flow Sem Salvar

1. Abra um workflow
2. Faça mudanças **sem salvar**
3. Clique em "Executar até aqui"
4. ✅ Usa/cria automaticamente 1 flow temporário

### Limpeza Manual

```bash
npm run cleanup:temp-flows
```

### Limpeza via API

```bash
curl http://localhost:3000/api/admin/cleanup-temp-flows
```

### Agendar Limpeza Automática (Cron)

```bash
# Adicionar ao crontab (executa todo dia às 3h AM)
0 3 * * * cd /path/to/project && npm run cleanup:temp-flows
```

## 🔒 Segurança

- ✅ Flag `isTemporary` explícita - não depende de nome
- ✅ Isolado por `userId` - cada usuário tem seu próprio
- ✅ Script só deleta com flag `isTemporary=true`
- ✅ Não afeta flows normais dos usuários

## 🎯 Benefícios

1. **Banco limpo** - Apenas 1 flow temporário por usuário
2. **Performance** - Menos registros = queries mais rápidas
3. **Seguro** - Flag explícita previne deleções acidentais
4. **Manutenível** - Script automático mantém banco organizado
5. **Rastreável** - Logs mostram o que foi deletado

## 📝 Notas

- Flows temporários são marcados com `isActive: false`
- Nome padrão: `Preview - User {userId}`
- Execuções parciais herdam `nodeExecutions` de execuções anteriores
- Limpeza remove flows com > 24h de inatividade
