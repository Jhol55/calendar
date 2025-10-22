# Changelog - React Query Implementation

## [1.0.1] - Correção de Imports

### Fixed

- ✅ Corrigido import de `getFlowExecutions` que não existia em `@/actions/executions/executions`
- ✅ Adaptado `useFlowExecutions` para usar `listExecutions` com parâmetros corretos
- ✅ Corrigido `useExecution` para usar `getExecution` do actions
- ✅ Renomeado `useCancelExecution` para `useStopExecution` (compatível com API)
- ✅ Adicionado alias `useCancelExecution` para backward compatibility
- ✅ Atualizado tipos de `Execution` para corresponder à API real

### Changed

- `useFlowExecutions` agora aceita parâmetros opcionais (limit, offset)
- `useStopExecution` substitui `useCancelExecution` (mas alias mantido)
- Status de execução agora: 'running' | 'success' | 'error' | 'stopped'

### Breaking Changes

Nenhuma! Todas as mudanças são backwards compatible.

---

## [1.0.0] - Initial Release

### Added

- ✅ Configurações otimizadas com 4 estratégias de cache
- ✅ Query keys factory com type-safety
- ✅ Hooks para workflows, user, database e executions
- ✅ Optimistic updates em todos mutations
- ✅ Error handling centralizado
- ✅ Rate limiting
- ✅ Persistent cache (opcional)
- ✅ Cross-tab sync (opcional)
- ✅ Documentação completa
- ✅ 13 exemplos práticos

### Security

- ✅ Validação automática de dados
- ✅ Sanitização de respostas
- ✅ Query key validation
- ✅ Error sanitization

### Performance

- ✅ Cache inteligente (4 estratégias)
- ✅ Prefetching
- ✅ Deduplicação automática
- ✅ Structural sharing
- ✅ Garbage collection
