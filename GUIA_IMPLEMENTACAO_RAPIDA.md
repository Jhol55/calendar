# ⚡ Guia de Implementação Rápida

**Objetivo**: Resolver problema de elementos não sendo encontrados em **4 horas de trabalho**.

---

## 🎯 O Que Vamos Fazer

### ✅ Fix 1: Validação Preventiva (30 min) - **MAIOR IMPACTO**

### ✅ Fix 2: Aumentar Snapshot (10 min)

### ✅ Fix 3: Prompt Semântico (2h)

### ✅ Fix 4: Timeout Adaptativo (1h)

---

## 🚀 Fix 1: Validação Preventiva (30 min)

### Arquivo: `web-scraper/api/routes/mcp/routes.py`

**Passo 1.1**: Adicionar função de validação no topo do arquivo (depois dos imports)

```python
def validate_selector_in_aria(selector: str, selector_type: str, aria_snapshot: str) -> tuple[bool, str]:
    """
    Verifica se seletor CSS existe na ARIA Snapshot.

    Returns:
        (is_valid, reason)
    """
    if not selector or not aria_snapshot:
        return False, "Seletor ou snapshot vazio"

    if selector_type != 'css':
        return True, "Não é CSS (não validamos XPath/outros)"

    # Verificar se seletor está explicitamente na snapshot
    # Formato na snapshot: [css=button.classe]
    if f"[css={selector}]" in aria_snapshot:
        return True, "Seletor encontrado na ARIA tree"

    # Se tem ID, verificar se ID existe
    if '#' in selector:
        element_id = selector.split('#')[1].split('.')[0].split('[')[0]
        if f"#{element_id}" in aria_snapshot:
            return True, f"ID #{element_id} encontrado"
        return False, f"ID #{element_id} não encontrado na snapshot"

    # Se tem classe, verificar se classe existe
    if '.' in selector and not selector.startswith('.'):
        # Extrair primeira classe: "button.abc.def" -> "abc"
        parts = selector.split('.')
        if len(parts) > 1:
            first_class = parts[1].split('[')[0].split(':')[0]
            if f".{first_class}" in aria_snapshot:
                return True, f"Classe .{first_class} encontrada"
            return False, f"Classe .{first_class} não encontrada na snapshot"

    # Caso genérico: ver se seletor base existe
    # Ex: "button" -> verificar se há algum button na snapshot
    selector_base = selector.split('.')[0].split('#')[0].split('[')[0]
    if selector_base and selector_base in aria_snapshot:
        return True, f"Tag {selector_base} encontrada"

    return False, "Seletor não encontrado na ARIA tree"
```

**Passo 1.2**: Modificar `_execute_single_action()` (linha ~470)

```python
def _execute_single_action(...):
    # ... código existente ...

    # 🚀 MELHORIA: Validação preventiva ANTES de tentar localizar
    primary_selector = action.selector

    # Validar seletor na ARIA tree (apenas para CSS)
    if primary_selector and action.selectorType == 'css':
        aria_snapshot = scraper.get_aria_snapshot(mode='ai')
        is_valid, reason = validate_selector_in_aria(primary_selector, action.selectorType, aria_snapshot)

        if not is_valid:
            logs.append(f"   ⚠️ Seletor CSS inválido: {reason}")
            logs.append(f"   🔄 Usando UniversalElementLocator como fallback...")

            # Usar UniversalElementLocator IMEDIATAMENTE
            try:
                universal = scraper.universal_locator
                result = universal.locate(
                    description=action.text or primary_selector or "elemento",
                    confidence_threshold=0.7
                )

                if result and result.element:
                    logs.append(f"   ✅ Elemento encontrado via fallback ({result.strategy}, confiança: {result.confidence:.2f})")

                    # Executar ação diretamente com elemento encontrado
                    if action.action == "click":
                        try:
                            result.element.click()
                            duration_ms = (time.time() - start_time) * 1000
                            if observability:
                                observability.record_action("click_fallback", duration_ms, "success")
                            if planner:
                                planner.record_action(planner_action, "success")
                            logs.append(f"   ✅ Click executado com sucesso via fallback")
                            return True
                        except Exception as e:
                            logs.append(f"   ❌ Erro ao executar click via fallback: {e}")
                            return False

                    elif action.action == "type":
                        try:
                            result.element.clear()
                            result.element.send_keys(action.text or "")
                            duration_ms = (time.time() - start_time) * 1000
                            if observability:
                                observability.record_action("type_fallback", duration_ms, "success")
                            if planner:
                                planner.record_action(planner_action, "success")
                            logs.append(f"   ✅ Type executado com sucesso via fallback")
                            return True
                        except Exception as e:
                            logs.append(f"   ❌ Erro ao executar type via fallback: {e}")
                            return False
                else:
                    logs.append(f"   ❌ Fallback também não encontrou elemento")
                    # Continuar com tentativa normal (última chance)
            except Exception as e:
                logs.append(f"   ⚠️ Erro no fallback: {e}")
                # Continuar com tentativa normal

    # ... resto do código continua igual ...
    # (código original de locator_factory, etc)
```

**Teste**:

```bash
# Testar com caso do Airbnb
# Antes: timeout de 3s + retry = 12s para falhar
# Depois: fallback imediato = 0.5s para encontrar
```

---

## 📏 Fix 2: Aumentar Snapshot (10 min)

### Arquivo: `web-scraper/app/web_scraper.py`

**Localizar linha ~520** (dentro de `get_aria_snapshot()`):

```python
# ANTES (linha ~520):
if len(aria_snapshot) > 12000:
    aria_snapshot = aria_snapshot[:12000] + "\n... (mais elementos disponíveis na página)"

# DEPOIS:
if len(aria_snapshot) > 25000:
    aria_snapshot = aria_snapshot[:25000] + "\n... (mais elementos disponíveis na página)"
```

**Passo 2.2**: Priorizar elementos importantes (mesma função)

```python
# Adicionar DEPOIS da captura da snapshot, ANTES da truncagem:

# 🚀 PRIORIZAÇÃO: Garantir que textboxes/buttons/modals estejam incluídos
if textbox_count > 0 or button_count > 10:
    # Se há muitos elementos, priorizar os importantes
    lines = aria_snapshot.split('\n')

    # Separar por tipo
    priority_lines = []  # textbox, button com keywords importantes
    modal_lines = []     # dialog, modal
    form_lines = []      # form, input
    other_lines = []     # resto

    important_keywords = ['filtro', 'filter', 'preço', 'price', 'buscar', 'search', 'entrar', 'login']

    for line in lines:
        line_lower = line.lower()

        # Prioridade 1: Textboxes e elementos com keywords importantes
        if 'textbox' in line_lower or any(kw in line_lower for kw in important_keywords):
            priority_lines.append(line)
        # Prioridade 2: Modals/dialogs
        elif 'dialog' in line_lower or 'modal' in line_lower:
            modal_lines.append(line)
        # Prioridade 3: Forms/inputs
        elif 'form' in line_lower or 'input' in line_lower:
            form_lines.append(line)
        else:
            other_lines.append(line)

    # Reconstruir snapshot com priorização
    prioritized = priority_lines + modal_lines + form_lines + other_lines
    aria_snapshot = '\n'.join(prioritized)

    logs.append(f"📊 [DEBUG] Snapshot priorizada: {len(priority_lines)} priority, {len(modal_lines)} modals, {len(form_lines)} forms")
```

---

## 🧠 Fix 3: Prompt Semântico (2h)

### Arquivo: `web-scraper/api/routes/mcp/routes.py`

**Passo 3.1**: Criar novo formato de ação (linha ~50, após imports)

```python
from typing import Literal

@dataclass
class SemanticLocator:
    """Localizador semântico (Playwright-like)"""
    strategy: Literal["role", "text", "aria_label", "placeholder", "css", "xpath"]
    value: str
    name: Optional[str] = None  # Para strategy="role"
    exact: bool = False

@dataclass
class SemanticAction:
    """Ação com localizador semântico"""
    action: str
    locator: SemanticLocator
    text: Optional[str] = None  # Para type actions
```

**Passo 3.2**: Atualizar prompt (função `_generate_actions_with_ai`, linha ~1750)

```python
# SUBSTITUIR prompt existente por:

prompt = f"""
Você é um agente de navegação web autônomo especializado em LOCALIZAÇÃO SEMÂNTICA.

{full_objective}
{last_action_info}

ESTADO ATUAL:
URL: {current_url} | Título: {page_title}

🌳 ÁRVORE DE ACESSIBILIDADE (formato hierárquico):
{interactive_elements}

🎯 COMO LOCALIZAR ELEMENTOS (PRIORIDADE):

**1. ROLE + NAME** (SEMPRE PREFIRA - 95% de confiabilidade):
Da árvore: `- button "Entrar" [ref=e10] [css=button.login]`
Gere: {{"strategy": "role", "value": "button", "name": "Entrar"}}

**2. TEXTO VISÍVEL** (90% de confiabilidade):
Da árvore: `- link "Cadastre-se" [ref=e15]`
Gere: {{"strategy": "text", "value": "Cadastre-se"}}

**3. ARIA-LABEL** (85% de confiabilidade):
Da árvore: `- button [aria-label="Fechar modal"] [ref=e20]`
Gere: {{"strategy": "aria_label", "value": "Fechar modal"}}

**4. PLACEHOLDER** (80% de confiabilidade - apenas inputs):
Da árvore: `- textbox [placeholder="Digite seu email"] [ref=e25]`
Gere: {{"strategy": "placeholder", "value": "Digite seu email"}}

**5. CSS** (ÚLTIMO RECURSO - 30% de confiabilidade):
APENAS se elemento NÃO tem role/texto/aria-label/placeholder
Da árvore: `- generic [ref=e30] [css=div.unique-identifier]`
Gere: {{"strategy": "css", "value": "div.unique-identifier"}}

⚠️ REGRAS CRÍTICAS:
- SEMPRE extraia role + name da ÁRVORE acima
- CSS classes dinâmicas (ex: l1ovpqvx, css-abc123) são INSTÁVEIS - evite!
- Se elemento tem role + name, use isso. NÃO use CSS.
- Formato da árvore: `role "nome" [ref=X] [css=seletor]`

📝 FORMATO DE RESPOSTA:
{{
  "goalAchieved": true|false,
  "answer": "string ou JSON" | null,
  "actions": [
    {{
      "action": "click|type|scroll_down|...",
      "locator": {{
        "strategy": "role|text|aria_label|placeholder|css",
        "value": "...",
        "name": "..."  // Apenas para strategy="role"
      }},
      "text": "..."  // Apenas para action="type"
    }}
  ]
}}

EXEMPLOS:

✅ CORRETO:
Árvore: `- button "Filtros" [ref=e42] [css=button.l1ovpqvx]`
Ação: {{"action": "click", "locator": {{"strategy": "role", "value": "button", "name": "Filtros"}}}}

❌ ERRADO:
Árvore: `- button "Filtros" [ref=e42] [css=button.l1ovpqvx]`
Ação: {{"action": "click", "locator": {{"strategy": "css", "value": "button.l1ovpqvx"}}}}
Razão: Usou CSS quando tinha role + name disponível!

✅ CORRETO:
Árvore: `- textbox "Preço mínimo" [ref=e50] [css=input#min-price]`
Ação: {{"action": "type", "locator": {{"strategy": "role", "value": "textbox", "name": "Preço mínimo"}}, "text": "200"}}

---

RESPONDA APENAS com JSON válido. Não adicione explicações fora do JSON.
"""
```

**Passo 3.3**: Processar novo formato (função `_execute_single_action`)

```python
# ADICIONAR no início de _execute_single_action():

def _execute_single_action_semantic(
    scraper: WebScraper, action: SemanticAction, logs: List[str]
) -> bool:
    """
    Executa ação usando localizador semântico.
    """
    locator = action.locator
    universal = scraper.universal_locator

    try:
        # Localizar elemento usando estratégia especificada
        if locator.strategy == "role":
            element = universal.get_by_role(
                role=locator.value,
                name=locator.name
            )
        elif locator.strategy == "text":
            element = universal.get_by_text(
                text=locator.value,
                exact=locator.exact
            )
        elif locator.strategy == "aria_label":
            # Usar locator CSS com aria-label
            css = f"[aria-label*='{locator.value}']"
            element = scraper.sb.find_element(By.CSS_SELECTOR, css)
        elif locator.strategy == "placeholder":
            element = universal.get_by_placeholder(locator.value)
        elif locator.strategy == "css":
            element = scraper.sb.find_element(By.CSS_SELECTOR, locator.value)
        else:
            logs.append(f"   ⚠️ Estratégia desconhecida: {locator.strategy}")
            return False

        if not element:
            logs.append(f"   ❌ Elemento não encontrado (strategy={locator.strategy})")
            return False

        # Executar ação
        if action.action == "click":
            element.click()
            logs.append(f"   ✅ Click executado (strategy={locator.strategy})")
            return True
        elif action.action == "type":
            element.clear()
            element.send_keys(action.text or "")
            logs.append(f"   ✅ Type executado (strategy={locator.strategy})")
            return True
        # ... outras ações ...

    except Exception as e:
        logs.append(f"   ❌ Erro ao executar ação semântica: {e}")
        return False
```

**Passo 3.4**: Manter compatibilidade com formato antigo

```python
# No início de _execute_single_action():

# Detectar se é formato novo (SemanticAction) ou antigo (StepAction)
if hasattr(action, 'locator'):  # Formato novo
    return _execute_single_action_semantic(scraper, action, logs)
else:  # Formato antigo
    # ... código existente ...
```

---

## ⏱️ Fix 4: Timeout Adaptativo (1h)

### Arquivo: `web-scraper/app/modules/locators.py`

**Passo 4.1**: Adicionar classe no topo do arquivo

```python
class AdaptiveTimeout:
    """
    Ajusta timeout baseado em performance histórica da página.
    """
    def __init__(self):
        self.page_speeds = {}  # {url_base: avg_load_time}

    def _get_base_url(self, url: str) -> str:
        """Extrai base URL (domínio) para agrupamento"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"

    def get_timeout(self, url: str) -> float:
        """Retorna timeout otimizado baseado em histórico"""
        base_url = self._get_base_url(url)
        base_timeout = 3.0

        if base_url in self.page_speeds:
            avg_load = self.page_speeds[base_url]

            if avg_load > 5.0:
                return 8.0  # Página muito lenta
            elif avg_load > 3.0:
                return 5.0  # Página lenta
            elif avg_load > 1.5:
                return 4.0  # Página moderada

        return base_timeout

    def record_load_time(self, url: str, load_time: float):
        """Registra tempo de carregamento para aprendizado"""
        base_url = self._get_base_url(url)

        if base_url not in self.page_speeds:
            self.page_speeds[base_url] = load_time
        else:
            # Média móvel exponencial (70% histórico + 30% novo)
            self.page_speeds[base_url] = (
                self.page_speeds[base_url] * 0.7 + load_time * 0.3
            )
```

**Passo 4.2**: Integrar na classe `UniversalElementLocator`

```python
# No __init__:
def __init__(self, scraper):
    self.scraper = scraper
    self.sb = scraper.sb
    self._cache = {}
    self.adaptive_timeout = AdaptiveTimeout()  # ✅ Adicionar
    self.timeout = 3.0  # Base timeout

# No método locate():
def locate(self, description: str, by: str = By.CSS_SELECTOR, selector: str = None, confidence_threshold: float = 0.8):
    # Ajustar timeout baseado em URL
    current_url = self.scraper.current_url()
    self.timeout = self.adaptive_timeout.get_timeout(current_url)  # ✅ Usar timeout adaptativo

    # ... resto do código ...

# No final do locate() (após encontrar elemento):
    if result:
        # Registrar tempo de sucesso
        elapsed = time.time() - start_time
        self.adaptive_timeout.record_load_time(current_url, elapsed)
```

---

## ✅ Checklist de Implementação

### Fix 1: Validação Preventiva

- [ ] Adicionar função `validate_selector_in_aria()`
- [ ] Modificar `_execute_single_action()` para chamar validação
- [ ] Testar com caso do Airbnb
- [ ] Verificar logs de fallback

### Fix 2: Aumentar Snapshot

- [ ] Mudar limite de 12KB para 25KB
- [ ] Adicionar priorização de elementos
- [ ] Testar com página complexa (Airbnb)
- [ ] Verificar que textboxes estão incluídos

### Fix 3: Prompt Semântico

- [ ] Criar classes `SemanticLocator` e `SemanticAction`
- [ ] Atualizar prompt da IA
- [ ] Implementar `_execute_single_action_semantic()`
- [ ] Manter compatibilidade com formato antigo
- [ ] Testar que IA gera strategy="role" majoritariamente

### Fix 4: Timeout Adaptativo

- [ ] Adicionar classe `AdaptiveTimeout`
- [ ] Integrar em `UniversalElementLocator`
- [ ] Testar com página lenta
- [ ] Verificar que timeout aumenta automaticamente

---

## 🧪 Como Testar

### Teste 1: Airbnb Filtros (Caso Real)

```python
# Objetivo: Clicar em "Filtros" e digitar preço mínimo/máximo

# Antes:
# - IA gera: {"selector": "button.l1ovpqvx", "selectorType": "css"}
# - Timeout 3s → falha → retry → 12s total
# - Não encontra inputs de preço (truncados)

# Depois (Esperado):
# - IA gera: {"strategy": "role", "value": "button", "name": "Filtros"}
# - Fallback imediato se CSS falhar → 0.5s
# - Inputs de preço incluídos na snapshot (25KB limite)
# - Taxa de sucesso: 95%
```

### Teste 2: Página Lenta

```python
# Simular página com load time de 5s
# Antes: Timeout de 3s → falha prematura
# Depois: Timeout adaptativo aumenta para 8s → sucesso
```

---

## 📊 Métricas de Sucesso

Após implementar, coletar métricas por 1 semana:

| Métrica                 | Meta   |
| ----------------------- | ------ |
| Taxa de sucesso (geral) | > 90%  |
| Tempo médio por ação    | < 2.5s |
| Uso de fallback         | < 10%  |
| Estratégia role/text    | > 70%  |
| Loops infinitos         | 0      |

---

## 🆘 Troubleshooting

### Problema: "validate_selector_in_aria não encontrado"

**Solução**: Verificar que a função foi adicionada ANTES de ser chamada em `_execute_single_action()`

### Problema: "IA ainda gera CSS em vez de role"

**Solução**:

1. Verificar que prompt foi atualizado
2. Adicionar mais exemplos no prompt
3. Testar com temperatura mais baixa (0.1)

### Problema: "Fallback não está sendo acionado"

**Solução**: Adicionar log logo após validação para confirmar que está sendo chamado

---

**Tempo Total Estimado**: 4 horas  
**Impacto Esperado**: Taxa de sucesso 70% → 90%  
**Prioridade**: 🔴 Crítica
