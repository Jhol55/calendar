# Input com Variáveis Dinâmicas

## Visão Geral

O componente `Input` foi aprimorado para detectar e visualizar variáveis dinâmicas no formato `{{variavel}}`, similar ao comportamento do n8n.

## Funcionalidades

### 1. Detecção Automática de Variáveis

O componente detecta automaticamente variáveis no formato `{{path.to.variable}}` no valor do input.

### 2. Estilo Visual Diferenciado

Quando variáveis dinâmicas são detectadas, elas são renderizadas com um estilo visual especial:

- **Cor de fundo**: Roxo claro (`bg-purple-100`)
- **Texto**: Roxo escuro (`text-purple-800`)
- **Borda**: Roxo médio (`border-purple-300`)
- **Hover**: Fundo roxo mais claro ao passar o mouse (`hover:bg-purple-200`)
- **Shadow**: Sombra sutil para destacar

### 3. Tooltip com Valor Resolvido

Ao passar o mouse sobre uma variável dinâmica, um tooltip é exibido mostrando:

- **Caminho da variável**: Nome do path da variável
- **Valor resolvido**: O valor real da variável do contexto do formulário

O tooltip aparece após um delay de 200ms e desaparece automaticamente ao remover o mouse.

## Como Funciona

### Exemplo de Uso

```tsx
import { Input } from '@/components/ui/input';

function MyComponent() {
  return <Input fieldName="message" placeholder="Digite sua mensagem" />;
}
```

### Exemplo com Variáveis

Se o valor do input for: `Olá {{user.name}}, você tem {{user.messages.count}} mensagens`

O componente irá:

1. Detectar duas variáveis: `{{user.name}}` e `{{user.messages.count}}`
2. Renderizar cada variável com o estilo roxo diferenciado
3. Ao passar o mouse sobre `{{user.name}}`, mostrar:
   - **Path**: `user.name`
   - **Valor**: O valor real de `form.user.name`
4. Ao passar o mouse sobre `{{user.messages.count}}`, mostrar:
   - **Path**: `user.messages.count`
   - **Valor**: O valor real de `form.user.messages.count`

## Implementação Técnica

### Componentes Criados

1. **Tooltip** (`src/components/ui/tooltip/tooltip.tsx`)

   - Componente genérico de tooltip
   - Usa React Portal para renderização no body
   - Posicionamento dinâmico baseado no elemento trigger

2. **Input Aprimorado** (`src/components/ui/input/input.tsx`)
   - Detecta variáveis com regex `/\{\{([^}]+)\}\}/g`
   - Renderiza overlay transparente sobre o input
   - Usa `replaceVariables` para resolver valores

### Fluxo de Renderização

1. **Detecção**: O componente verifica se o valor contém variáveis usando regex
2. **Parse**: Se houver variáveis, o valor é parseado em partes (texto + variáveis)
3. **Renderização Dual**:
   - Input normal para entrada de dados
   - Overlay visual com variáveis estilizadas
4. **Resolução**: Ao hover, `replaceVariables` é chamado para obter o valor real

### Estilo do Overlay

O overlay é posicionado absolutamente sobre o input com:

- `pointer-events-none`: Não interfere na digitação
- `pointer-events-auto` nas variáveis: Permite hover e tooltip
- Texto transparente para partes não-variáveis: Mantém alinhamento visual

## Limitações Atuais

- Funciona para inputs dos tipos: `text`, `tel`, `email`, `url`, `search`, `number`
- Variáveis devem estar no formato `{{path.to.variable}}`
- O overlay pode ter problemas de alinhamento com textos muito longos
- Os valores das variáveis só são mostrados se houver uma execução disponível do flow

## Possíveis Melhorias Futuras

1. Suporte para outros tipos de input (textarea, etc)
2. Auto-complete de variáveis ao digitar `{{`
3. Validação de paths de variáveis
4. Cache de valores resolvidos para melhor performance
5. Sintaxe colorida dentro do tooltip para JSON/objetos
