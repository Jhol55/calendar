# GitHub Actions Workflows

Este diretório contém os workflows de CI/CD do projeto.

## 📁 Estrutura

```
.github/workflows/
├── ci.yml          # Integração Contínua (testes, lint, build)
├── cd.yml          # Deploy Contínuo (produção)
├── preview.yml     # Builds de preview para PRs
├── release.yml     # Criação automática de releases
└── security.yml    # Varredura de segurança
```

## 🔄 Workflows

### CI (ci.yml)

**Trigger:** Pull Requests e pushes para `main`/`develop`

**Jobs:**

- ✅ Lint e Type Check
- ✅ Testes Unitários
- ✅ Testes de Integração
- ✅ Build da Aplicação

### CD (cd.yml)

**Trigger:** Pushes para `main` e tags `v*`

**Jobs:**

- 🐳 Build e push de imagens Docker
- 🚀 Deploy em produção
- 📢 Notificações

### Preview (preview.yml)

**Trigger:** Pull Requests

**Funcionalidade:**

- Cria build de preview
- Comenta na PR com instruções
- Permite testar mudanças antes do merge

### Release (release.yml)

**Trigger:** Tags `v*`

**Funcionalidade:**

- Gera changelog automático
- Cria GitHub Release
- Documenta versão e imagens Docker

### Security (security.yml)

**Trigger:** Pushes, PRs e agendamento semanal

**Scans:**

- 🔍 Dependências (npm audit + Snyk)
- 🐳 Imagens Docker (Trivy)
- 💻 Código (CodeQL)

## 🔧 Configuração

Veja o arquivo `CI-CD-GUIDE.md` na raiz do projeto para instruções completas de configuração.

### Secrets Necessários

```
DEPLOY_HOST         # Servidor de produção
DEPLOY_USER         # Usuário SSH
DEPLOY_SSH_KEY      # Chave SSH privada
DEPLOY_PATH         # Caminho no servidor
```

### Secrets Opcionais

```
SNYK_TOKEN          # Token Snyk
SLACK_WEBHOOK_URL   # Webhook Slack
DISCORD_WEBHOOK_URL # Webhook Discord
```

## 📝 Como Usar

### Deploy Manual

```bash
gh workflow run cd.yml
```

### Criar Release

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### Testar Workflow Localmente

```bash
# Instale act: https://github.com/nektos/act
act -j lint-and-typecheck
```

## 🆘 Suporte

Para mais informações, consulte o `CI-CD-GUIDE.md` completo.
