# Limpeza de Flows Temporários

## 📋 Visão Geral

Quando você executa um workflow sem salvar, o sistema cria um **flow temporário** para permitir a execução. Para evitar poluição do banco de dados, implementamos:

1. **Reutilização**: Cada usuário tem apenas UM flow temporário (`[TEMP] user_{userId}_preview`)
2. **Limpeza automática**: Flows temporários com mais de 24h são deletados

## 🔧 Como Funciona

### Criação de Flows Temporários

```
Usuário 1 executa sem salvar:
├─ 1ª execução → Cria: [TEMP] user_1_preview
├─ 2ª execução → Reutiliza: [TEMP] user_1_preview ✅
└─ 3ª execução → Reutiliza: [TEMP] user_1_preview ✅

Usuário 2 executa sem salvar:
└─ 1ª execução → Cria: [TEMP] user_2_preview
```

**Resultado**: Apenas 2 flows temporários ao invés de múltiplos!

## 🧹 Métodos de Limpeza

### 1. Script Manual (Node.js)

Execute quando quiser limpar flows antigos:

```bash
npm run cleanup:temp-flows
```

**Output:**

```
🧹 Iniciando limpeza de flows temporários...
📊 Encontrados 15 flows temporários antigos (> 24h)
🗑️  Deletadas 47 execuções de flows temporários
🗑️  Deletados 15 flows temporários
✅ Limpeza concluída!
```

### 2. API Endpoint

Chame via HTTP (útil para cron jobs externos):

```bash
curl http://localhost:3000/api/admin/cleanup-temp-flows
```

**Response:**

```json
{
  "success": true,
  "message": "Limpeza concluída com sucesso",
  "deleted": {
    "flows": 15,
    "executions": 47
  },
  "details": [...]
}
```

### 3. Cron Job Automático (Recomendado)

Configure um cron job para executar diariamente:

#### Linux/Mac (crontab)

```bash
# Executar todo dia às 3h da manhã
0 3 * * * cd /path/to/project && npm run cleanup:temp-flows >> /var/log/temp-flows-cleanup.log 2>&1
```

#### Windows (Task Scheduler)

1. Abrir "Task Scheduler"
2. Criar nova tarefa
3. Trigger: Diário às 3h
4. Action: `cmd /c cd C:\path\to\project && npm run cleanup:temp-flows`

#### Docker (docker-compose)

Adicione um serviço de cleanup:

```yaml
services:
  cleanup-cron:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: sh -c "while true; do npm run cleanup:temp-flows && sleep 86400; done"
    depends_on:
      - postgres
```

## 🔍 Monitoramento

### Verificar Flows Temporários Atuais

```sql
-- Contar flows temporários
SELECT COUNT(*) as total_temp_flows
FROM chatbot_flows
WHERE name LIKE '[TEMP]%'
AND "isActive" = false;

-- Listar por usuário
SELECT "userId", COUNT(*) as flows_count
FROM chatbot_flows
WHERE name LIKE '[TEMP]%'
AND "isActive" = false
GROUP BY "userId";

-- Ver mais antigos
SELECT id, name, "userId", "updatedAt"
FROM chatbot_flows
WHERE name LIKE '[TEMP]%'
AND "isActive" = false
ORDER BY "updatedAt" ASC
LIMIT 10;
```

## ⚙️ Configuração

### Alterar Tempo de Retenção

Por padrão, flows temporários são mantidos por **24 horas**. Para alterar:

**No script (`cleanup-temp-flows.js`):**

```javascript
// Mudar de 24h para 48h
oneDayAgo.setHours(oneDayAgo.getHours() - 48);
```

**Na API (`cleanup-temp-flows/route.ts`):**

```typescript
// Mudar de 24h para 12h
oneDayAgo.setHours(oneDayAgo.getHours() - 12);
```

## 📊 Estatísticas

Antes da otimização:

- ❌ Cada execução sem salvar = 1 novo flow
- ❌ 100 execuções = 100 flows temporários

Depois da otimização:

- ✅ 1 flow por usuário
- ✅ 100 execuções de 10 usuários = 10 flows temporários
- ✅ Redução de 90%!

## 🚨 Importante

- Flows temporários **NÃO afetam** workflows salvos normais
- Apenas flows com `isActive = false` e nome iniciando com `[TEMP]` são deletados
- Execuções relacionadas são deletadas automaticamente (FK cascade)
- A limpeza é **segura** e pode ser executada a qualquer momento

## 🐛 Troubleshooting

### "Nenhum flow temporário encontrado"

✅ Isso é bom! Significa que não há flows antigos para limpar.

### Erro de permissão no banco

Verifique se o usuário do Prisma tem permissão de `DELETE` nas tabelas `chatbot_flows` e `flow_executions`.

### Limpeza muito agressiva

Aumente o tempo de retenção para 48h ou mais.

### Flows temporários não sendo criados

Verifique se `userId` está sendo passado corretamente na API de execução parcial.
