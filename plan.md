# 🧪 Testes E2E (Integração de Serviço) — DatabaseNodeService

A maior complexidade do projeto é que foi criado um **sistema de banco de dados em memória (in-memory)** que usa o **Postgres como camada de persistência**.

Quase toda a lógica de negócios (**filtragem, ordenação, paginação, validação, particionamento**) é executada pelo **Node.js**, e não pelo Postgres via SQL.  
Isso significa que os **testes E2E** são menos sobre “testar o Next.js” e mais sobre **testar o DatabaseNodeService** como um **serviço de integração contra um banco real**, garantindo que a manipulação de JSON e estado em memória funcione corretamente.

---

## ✅ Checklist para Testes E2E

### 1. Ambiente e Ferramentas 🧰

- [ ] **Test Runner:** Instalar um framework de testes.  
      👉 Recomendado: **Vitest**, rápido e integrado com TypeScript/Next.js

  ```bash
  npm install -D vitest
  ```

- [ ] **Banco de Dados de Teste Isolado:**  
      Criar um `docker-compose.test.yml` (ou um serviço separado no `docker-compose.yml`) que rode uma instância **dedicada do Postgres** para testes, em uma **porta diferente** (ex: `5433`).

- [ ] **Arquivo de Ambiente de Teste:**  
      Criar um arquivo `.env.test` para ser usado pelos scripts de teste.

- [ ] **Variável `DATABASE_URL`:**  
      No `.env.test`, definir a conexão para o banco de teste:

  ```
  DATABASE_URL=postgresql://user:pass@localhost:5433/db_test
  ```

- [ ] **Script de Migração:**  
      Garantir que o **Prisma** possa aplicar as migrações no banco de teste.  
      Adicione no `package.json`:
  ```json
  "scripts": {
    "test:migrate": "prisma migrate deploy"
  }
  ```
  ou, para desenvolvimento:
  ```json
  "test:migrate": "prisma db push"
  ```

---

### 2. O Blocker Principal: Isolamento de Estado ⛔

O `databaseNodeService` é um **singleton**, o que significa que **cache, métricas e limites de taxa** são **compartilhados entre todos os testes**.

Isso causa:

- Cache de schema persistente entre testes
- Rate limit sendo acionado em testes subsequentes
- Falhas aleatórias e comportamento não determinístico

#### 🧩 Ações Mandatórias

- [ ] **Refatorar o Singleton:**

Mudar de:

```ts
export const databaseNodeService = new DatabaseNodeService();
```

Para:

```ts
export { DatabaseNodeService };
```

Crie a instância **onde ela for usada**, ou utilize **injeção de dependência**.

- [ ] **Criar Nova Instância por Teste:**

```ts
import { DatabaseNodeService } from '@/services/database/database.service';

describe('DatabaseNodeService', () => {
  let service: DatabaseNodeService;

  beforeEach(() => {
    service = new DatabaseNodeService(); // garante cache e rate limit limpos
  });

  // ... testes
});
```

- [ ] **Script de Limpeza de Banco (`beforeEach`):**

```ts
import { prisma } from '@/services/prisma';

beforeEach(async () => {
  service = new DatabaseNodeService();
  await prisma.dataTable.deleteMany({}); // limpa a tabela
});
```

---

### 3. Configuração e Mocks 🔧

- [ ] **Mockar o `DATABASE_CONFIG`:**  
      Use `vi.mock` do Vitest para sobrescrever constantes com valores reduzidos:

```ts
vi.mock('@/config/database.config', () => ({
  DATABASE_CONFIG: {
    MAX_PARTITION_SIZE: 5,
    MAX_PARTITIONS_PER_TABLE: 3,
    MAX_TABLES_PER_USER: 2,
    BATCH_SIZE: 2,
    BATCH_DELAY: 0,
    MAX_EXECUTION_TIME: 1000,
  },
}));
```

---

### 4. Testes de Unidade (Lógica Pura) 🎯

- [ ] **Validadores:**

  - Testar `validateTableName`, `validateColumns`, `validateFieldType`.
  - Exemplo:
    ```ts
    expect(() => service.validateTableName('nome inválido')).toThrow();
    ```

- [ ] **validateRecord:**  
      Testar lógica de campos `required`, aplicação de `default` e falhas de tipo.

- [ ] **matchesRule / matchesFilters (Crítico):**  
      É o **motor de query**. Testar extensivamente:

  - Cada operador (`equals`, `notEquals`, `greaterThan`, `lessThan`, `contains`, `in`, `isNull`, `isTrue`, `isEmpty` etc.)
  - Coerção de tipo (`tryNumericComparison`)
    ```ts
    { val: 10 } deve bater com filtro { val: '10' }
    ```
  - Lógica `AND` vs `OR`

- [ ] **sortRecords:**  
      Testar ordenação asc/desc e o comportamento de `null`/`undefined` (devem ir para o fim).

---

### 5. Testes de Integração (Lógica + DB) 🚀

#### 🧱 Fluxo de Schema

- [ ] `addColumns` → cria tabela
- [ ] `addColumns` novamente → adiciona colunas mantendo dados
- [ ] `removeColumns` → remove colunas do schema **e** dos dados

#### 📦 Lógica de Particionamento

- [ ] Com `MAX_PARTITION_SIZE = 5`:  
      Inserir **6 registros**, verificar:
  - Duas partições (`isFull: true` e `isFull: false`)
- [ ] `getRecords` → deve retornar todos os 6 registros
- [ ] Limite de partições (`MAX_PARTITIONS = 3`) → deve lançar erro `PARTITION_LIMIT`

#### ⚙️ Lógica de Lote (`BATCH_SIZE = 2`)

- [ ] Inserir **5 registros**
- [ ] Executar `updateRecords`
  - `WriteResult` deve conter `batchInfo`
  - `totalBatches = 3 (2 + 2 + 1)`
- [ ] Repetir para `deleteRecords`

#### 🧹 Lógica de Deleção

- [ ] Testar `deleteRecords`
- [ ] Após remoção, `isFull` da partição deve ser atualizado para `false`

#### 📊 Estatísticas

- [ ] Testar `getTableStats`
  - Validar `totalRecords`, `totalPartitions`, `fullPartitions`

#### 🔒 Segurança e Limites

- [ ] `checkTableLimit` → respeitar `MAX_TABLES_PER_USER = 2`
- [ ] `verifyTableOwnership` → impedir acesso de outro `userId`
- [ ] `checkRateLimit` → mockar limite 3 e chamar `insertRecord` 4 vezes (deve falhar)

---

### 🧭 Conclusão

Esses testes garantem:

- Isolamento de estado entre execuções
- Validação da lógica em memória
- Integração correta com o Postgres real
- Confiabilidade dos mecanismos de cache, particionamento e rate limit
