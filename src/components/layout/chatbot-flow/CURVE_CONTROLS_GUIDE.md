# Guia de Controles de Curva - Flow Editor

## 📐 Funcionalidade de Handles Arrastáveis

O Flow Editor agora possui **handles arrastáveis dinâmicos** nos pontos de controle das curvas que conectam os nós. Isso permite ajustar visualmente a forma das conexões entre os nós.

## ✨ Características Principais

### 1. **Pontos de Controle Dinâmicos e Simétricos**

- Número de handles aumenta automaticamente com a distância
- Distribuição simétrica e uniforme ao longo da curva
- Representados por círculos cinza com borda branca
- Sempre posicionados **sobre a linha** da curva

| Distância entre Nós | Quantidade de Handles | Distribuição                 |
| ------------------- | --------------------- | ---------------------------- |
| < 300px             | 2 handles             | 33%, 67%                     |
| 300-500px           | 3 handles             | 25%, 50%, 75%                |
| 500-700px           | 4 handles             | 20%, 40%, 60%, 80%           |
| 700-900px           | 5 handles             | 16%, 33%, 50%, 67%, 83%      |
| > 900px             | 6 handles             | 14%, 28%, 43%, 57%, 71%, 86% |

### 2. **Arraste Intuitivo**

- **Como usar**: Clique e arraste qualquer handle
- **Cursor**: Muda para "grab" ao passar sobre o handle
- **Feedback visual**: O handle fica azul quando está sendo arrastado
- **Múltiplos handles**: Arraste cada um independentemente
- **Visibilidade**: Aparecem apenas no hover ou quando a edge está selecionada

### 3. **Sistema de Posição Relativa**

- Os handles usam **offsets relativos** ao invés de coordenadas absolutas
- **Mantém a forma da curva** quando você move os nós
- Recalcula automaticamente as posições baseado na nova posição dos nós
- **Sincronização inteligente**: Preserva ajustes quando o número de handles muda

### 4. **Handles Sempre na Linha**

- Os handles ficam **sempre sobre a curva** (não flutuando fora)
- Calculados usando a fórmula paramétrica de Bezier cúbica
- O sistema calcula:
  - **Componente paralelo**: Posição ao longo da linha (0-1)
  - **Componente perpendicular**: Distância perpendicular à linha reta (max 50% da distância)
- Isso garante que a curva mantenha sua forma relativa quando os nós se movem

## 🎯 Como Usar

### Ajustando Curvas

1. **Conecte dois nós** normalmente
2. **Passe o mouse sobre a conexão** ou **clique na linha** para ativar os handles
3. **Veja os handles aparecerem** (quantidade varia com a distância)
4. **Clique e arraste** qualquer handle para ajustar a curva
5. **Solte** para fixar a posição

### Movendo Nós

- Quando você move um nó, **as curvas se ajustam automaticamente**
- Os handles mantêm sua **posição relativa**
- A forma da curva é preservada
- **Número de handles se ajusta** automaticamente à nova distância

### Handles Dinâmicos

- **Afaste os nós**: Mais handles aparecem automaticamente
- **Aproxime os nós**: Handles são reduzidos simetricamente
- **Ajustes preservados**: Mesmo quando o número muda, ajustes próximos são mantidos

## 🔧 Implementação Técnica

### CustomBezierEdge

- **Localização**: `custom-bezier-edge.tsx`
- **Tipo de curva**: Bezier cúbica
- **Armazenamento**: Offsets relativos salvos no `data` da edge

### Estrutura de Dados

```typescript
interface ControlPointOffset {
  ratioX: number; // 0-1, posição ao longo da linha
  ratioY: number; // Offset vertical adicional
  perpendicular: number; // Distância perpendicular (max 50% da distância)
  t: number; // Posição t na curva onde o handle aparece
}

interface CustomEdgeData {
  controlPointOffsets?: ControlPointOffset[]; // Array dinâmico de handles
}
```

### Cálculo Automático

O componente recalcula as posições e quantidade dos handles sempre que:

- `sourceX`, `sourceY` mudam (nó de origem se move)
- `targetX`, `targetY` mudam (nó de destino se move)
- A distância entre os nós cruza um threshold (300px, 500px, 700px, 900px)

### Distribuição Simétrica

```
Linha curta (200px):  ●════●════●  (2 handles em 33% e 67%)
Linha média (400px):  ●═══●═══●═══●  (3 handles em 25%, 50%, 75%)
Linha longa (800px):  ●══●══●══●══●  (5 handles distribuídos uniformemente)
```

## 💡 Dicas

1. **Curvas Suaves**: Handles próximos à linha reta = curva suave
2. **Curvas Dramáticas**: Arraste handles perpendiculares à linha para curvas acentuadas
3. **Múltiplos Ajustes**: Com mais handles (linhas longas), você pode criar formas complexas como S ou ondas
4. **Reset**: Delete a conexão e reconecte os nós para resetar a curva
5. **Visualização**: Use zoom para precisão em curvas pequenas
6. **Simetria**: Os handles são distribuídos simetricamente automaticamente

## 🎨 Estilo Visual

- **Handles**: Círculos duplos
  - Círculo externo: Branco, 7px de raio
  - Círculo interno: 5px de raio
    - Cor normal: Cinza (`#64748b`)
    - Cor arrastando: Azul (`#3b82f6`)
  - Área de clique: 12px de raio (invisível)
  - Sombra suave: `drop-shadow(0 2px 6px rgba(0,0,0,0.2))`
- **Visibilidade**: Aparecem apenas em hover ou seleção

## 🚀 Recursos Implementados

- ✅ **Handles dinâmicos**: Quantidade aumenta com a distância
- ✅ **Distribuição simétrica**: Sempre uniformemente espaçados
- ✅ **Handles na linha**: Sempre sobre a curva, não flutuando
- ✅ **Persistência**: Ajustes salvos no banco de dados
- ✅ **Sincronização inteligente**: Preserva ajustes quando possível
- ✅ **Visibilidade inteligente**: Aparecem apenas quando necessário

## 🎯 Possíveis Melhorias Futuras

- Snap to grid para handles
- Presets de curvas (S-curve, arco, loop, etc.)
- Botão de reset na UI
- Configuração de estilo (espessura, cor, etc.)
- Animação suave ao adicionar/remover handles

---

**Nota**: Esta funcionalidade é automaticamente ativada para todas as edges no Flow Editor. O número de handles se ajusta dinamicamente baseado na distância entre os nós.
