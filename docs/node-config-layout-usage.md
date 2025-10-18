# Como Usar o NodeConfigLayout

## Visão Geral

O `NodeConfigLayout` é um componente reutilizável que fornece um layout padronizado para configuração de nós com painéis de entrada e saída de execuções.

## Estrutura

```
┌─────────────┬──────────────────┬─────────────┐
│  Entrada    │   Configuração   │   Saída     │
│  (25%)      │      (50%)       │   (25%)     │
└─────────────┴──────────────────┴─────────────┘
```

## Props

```typescript
interface NodeConfigLayoutProps {
  isOpen: boolean; // Controla abertura do dialog
  onClose: () => void; // Callback ao fechar
  title: string; // Título da configuração
  nodeId?: string; // ID do nó (opcional)
  flowId?: string; // ID do fluxo (opcional)
  children: ReactNode; // Conteúdo do formulário
}
```

## Exemplo de Uso

### 1. Criar o componente de configuração

```typescript
// condition-node-config.tsx
'use client';

import React from 'react';
import { NodeConfigLayout } from './node-config-layout';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';

interface ConditionNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: ConditionConfig;
  onSave: (config: ConditionConfig) => void;
  nodeId?: string;
  flowId?: string;
}

export function ConditionNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
}: ConditionNodeConfigProps) {
  const handleSubmit = async (data: any) => {
    onSave(data);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Condição"
      nodeId={nodeId}
      flowId={flowId}
    >
      <Form onSubmit={handleSubmit}>
        {/* Seus campos de formulário aqui */}
        <Input fieldName="variable" placeholder="Variável" />
        <Input fieldName="operator" placeholder="Operador" />
        <Input fieldName="value" placeholder="Valor" />

        <SubmitButton>Salvar</SubmitButton>
      </Form>
    </NodeConfigLayout>
  );
}
```

### 2. Usar no Flow Editor

```typescript
// flow-editor.tsx
import { ConditionNodeConfig } from './nodes/condition-node-config';

function FlowEditor() {
  return (
    <>
      {/* ... outros componentes */}

      <ConditionNodeConfig
        isOpen={conditionDialogOpen}
        onClose={() => setConditionDialogOpen(false)}
        config={nodeToConfig?.data.conditionConfig}
        onSave={handleSaveConditionConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
      />
    </>
  );
}
```

## Recursos

### ✅ Incluídos automaticamente:

1. **Painéis laterais** - Entrada e Saída com dados de execução
2. **Botão toggle** - Mostrar/Ocultar painéis
3. **Scroll automático** - Cada painel tem scroll independente
4. **Responsividade** - Ajusta largura baseado nos painéis
5. **Zoom** - 90% para melhor aproveitamento de espaço

### 🎨 Estilos mantidos:

- Classes CSS preservadas
- Layout flex com 3 colunas
- Scroll vertical em cada seção
- Cores e espaçamentos originais

## Exemplo de Nós

### API Node

```typescript
<NodeConfigLayout
  isOpen={isOpen}
  onClose={onClose}
  title="🌐 Configurar API"
  nodeId={nodeId}
  flowId={flowId}
>
  <Form onSubmit={handleSubmit}>
    <Input fieldName="url" placeholder="URL da API" />
    <Input fieldName="method" placeholder="Método HTTP" />
    <Textarea fieldName="body" placeholder="Body JSON" />
    <SubmitButton>Salvar</SubmitButton>
  </Form>
</NodeConfigLayout>
```

### Delay Node

```typescript
<NodeConfigLayout
  isOpen={isOpen}
  onClose={onClose}
  title="⏱️ Configurar Delay"
  nodeId={nodeId}
  flowId={flowId}
>
  <Form onSubmit={handleSubmit}>
    <Input
      type="number"
      fieldName="delay"
      placeholder="Tempo em milissegundos"
    />
    <SubmitButton>Salvar</SubmitButton>
  </Form>
</NodeConfigLayout>
```

### Question Node

```typescript
<NodeConfigLayout
  isOpen={isOpen}
  onClose={onClose}
  title="❓ Configurar Pergunta"
  nodeId={nodeId}
  flowId={flowId}
>
  <Form onSubmit={handleSubmit}>
    <Textarea fieldName="question" placeholder="Pergunta" />
    <Input fieldName="variableName" placeholder="Nome da variável" />
    <Select fieldName="expectedType" options={types} />
    <SubmitButton>Salvar</SubmitButton>
  </Form>
</NodeConfigLayout>
```

## Comportamento

### Sem nodeId/flowId

- Painéis laterais não aparecem
- Layout centralizado (40vw)
- Ideal para nós sem execução

### Com nodeId/flowId

- Painéis laterais aparecem
- Layout expandido (95vw)
- Mostra dados de entrada/saída
- Permite copiar variáveis

## Variáveis Dinâmicas

Os painéis laterais permitem:

1. **Visualizar** dados de execução
2. **Copiar** variáveis com um clique
3. **Colar** em campos do formulário
4. **Usar** valores dinâmicos

Exemplo:

```
Entrada: { nome: "João", email: "joao@email.com" }
Copiar: {{$node.input.nome}}
Colar no campo: "Olá {{$node.input.nome}}!"
Resultado: "Olá João!"
```

## Migração de Nós Existentes

### Antes:

```typescript
return (
  <Dialog isOpen={isOpen} onClose={onClose}>
    {/* Todo o layout manualmente */}
  </Dialog>
);
```

### Depois:

```typescript
return (
  <NodeConfigLayout
    isOpen={isOpen}
    onClose={onClose}
    title="⚙️ Título"
    nodeId={nodeId}
    flowId={flowId}
  >
    {/* Apenas o conteúdo do formulário */}
  </NodeConfigLayout>
);
```

## Benefícios

✅ **Consistência** - Todos os nós têm o mesmo layout
✅ **Manutenibilidade** - Mudanças em um lugar afetam todos
✅ **Reutilização** - Código DRY (Don't Repeat Yourself)
✅ **Escalabilidade** - Fácil adicionar novos nós
✅ **UX** - Experiência uniforme para o usuário
