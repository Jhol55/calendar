# Guia de CI/CD - Wazzy

Este guia explica como configurar e usar o sistema de CI/CD do projeto Wazzy.

## 📋 Visão Geral

O projeto possui 4 workflows principais de CI/CD:

1. **CI (Integração Contínua)** - Executa em PRs e pushes
2. **CD (Entrega Contínua)** - Deploy automático na branch main
3. **Preview** - Builds de preview para Pull Requests
4. **Security** - Varredura de segurança semanal e em cada commit

## 🚀 Configuração Inicial

### 1. Configurar Secrets no GitHub

Acesse: `Settings` > `Secrets and variables` > `Actions` > `New repository secret`

#### Secrets Obrigatórios para Deploy:

```
DEPLOY_HOST          # IP ou domínio do servidor (ex: 123.45.67.89)
DEPLOY_USER          # Usuário SSH (ex: ubuntu)
DEPLOY_SSH_KEY       # Chave SSH privada para acesso ao servidor
DEPLOY_PATH          # Caminho no servidor (ex: /home/ubuntu/wazzy)
```

#### Secrets Opcionais:

```
SNYK_TOKEN           # Token do Snyk para varredura de vulnerabilidades
SLACK_WEBHOOK_URL    # Webhook para notificações no Slack
DISCORD_WEBHOOK_URL  # Webhook para notificações no Discord
```

### 2. Configurar Variáveis de Ambiente

Acesse: `Settings` > `Secrets and variables` > `Actions` > `Variables`

```
DATABASE_URL         # URL do banco de dados de produção
NEXT_PUBLIC_API_URL  # URL da API pública
SECRET_KEY           # Chave secreta da aplicação
REDIS_HOST           # Host do Redis
REDIS_PORT           # Porta do Redis (padrão: 6379)
```

### 3. Configurar Environments

1. Acesse: `Settings` > `Environments`
2. Crie um environment chamado `production`
3. Configure proteções:
   - ✅ Required reviewers (adicione revisores)
   - ✅ Wait timer (opcional: tempo de espera antes do deploy)
   - ✅ Deployment branches (selecione `main`)

## 📊 Workflows Detalhados

### CI Workflow (`.github/workflows/ci.yml`)

**Quando executa:**

- Em todos os Pull Requests
- Em pushes para `main` e `develop`

**Jobs:**

1. **lint-and-typecheck**: Verifica código e tipos TypeScript
2. **test-unit**: Executa testes unitários
3. **test-integration**: Executa testes de integração com serviços
4. **build**: Compila a aplicação

**Tempo estimado:** 5-10 minutos

### CD Workflow (`.github/workflows/cd.yml`)

**Quando executa:**

- Em pushes para `main`
- Em tags de versão (ex: `v1.0.0`)
- Manualmente via `workflow_dispatch`

**Jobs:**

1. **build-and-push**: Constrói e publica imagens Docker
   - App: `ghcr.io/seu-usuario/wazzy-app:latest`
   - Worker: `ghcr.io/seu-usuario/wazzy-worker:latest`
2. **deploy**: Faz deploy no servidor de produção

**Tempo estimado:** 10-15 minutos

### Preview Workflow (`.github/workflows/preview.yml`)

**Quando executa:**

- Em Pull Requests (abertos ou atualizados)

**Funcionalidade:**

- Gera build de preview
- Publica imagem Docker com tag da PR
- Comenta na PR com instruções para testar

### Security Workflow (`.github/workflows/security.yml`)

**Quando executa:**

- Em pushes para `main` e `develop`
- Em Pull Requests
- Toda segunda-feira às 9h UTC

**Scans:**

1. **Dependências**: npm audit + Snyk
2. **Docker**: Trivy vulnerability scanner
3. **Código**: CodeQL analysis

## 🔧 Configurações Específicas

### Opção 1: Deploy via SSH (Padrão)

O workflow usa SSH para conectar ao servidor e executar comandos Docker.

**Preparação do servidor:**

```bash
# No servidor de produção
cd /home/ubuntu
git clone <seu-repositorio> wazzy
cd wazzy

# Criar arquivo .env
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://postgres:senha@postgres:5432/calendar
SECRET_KEY=sua-chave-secreta
NEXT_PUBLIC_API_URL=https://seu-dominio.com/api
REDIS_HOST=redis
REDIS_PORT=6379
EOF

# Primeiro deploy manual
docker compose up -d
```

### Opção 2: Deploy com Docker Registry Privado

Se usar um registry privado (AWS ECR, DockerHub, etc):

```yaml
# Adicione no job build-and-push
- name: Log in to Private Registry
  uses: docker/login-action@v3
  with:
    registry: registry.seu-dominio.com
    username: ${{ secrets.REGISTRY_USERNAME }}
    password: ${{ secrets.REGISTRY_PASSWORD }}
```

### Opção 3: Deploy no Kubernetes

Descomente a seção Kubernetes no arquivo `cd.yml`:

```yaml
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/wazzy-app app=...
    kubectl rollout status deployment/wazzy-app
```

**Secrets necessários:**

```
KUBE_CONFIG    # Conteúdo do arquivo kubeconfig
```

### Opção 4: Deploy em Serviços Cloud

#### Vercel

```bash
npm install -g vercel
vercel --token ${{ secrets.VERCEL_TOKEN }}
```

#### Railway

```bash
railway up
```

#### AWS ECS/Fargate

Use a action `aws-actions/amazon-ecs-deploy-task-definition@v1`

## 📦 Gerenciamento de Versões

### Criando Releases

```bash
# Criar tag de versão
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Isso automaticamente:
# 1. Executa o CI
# 2. Constrói as imagens Docker
# 3. Tageia com v1.0.0, 1.0, e latest
# 4. Faz deploy em produção
```

### Versionamento Semântico

- **v1.0.0** (MAJOR): Mudanças incompatíveis
- **v1.1.0** (MINOR): Novas funcionalidades compatíveis
- **v1.1.1** (PATCH): Correções de bugs

## 🔍 Monitoramento e Logs

### Visualizar Logs dos Workflows

1. Acesse a aba `Actions` no GitHub
2. Selecione o workflow
3. Clique no run específico
4. Expanda os jobs e steps para ver logs detalhados

### Logs do Servidor

```bash
# No servidor
docker compose logs -f app
docker compose logs -f worker
```

### Métricas de Build

- Build Cache: Reduz tempo de build em ~60%
- Parallel Jobs: CI executa jobs em paralelo
- Artifact Caching: Reutiliza dependências entre runs

## 🚨 Troubleshooting

### Build Falhando

```bash
# Localmente, teste o build Docker:
docker build -t wazzy-test .
docker run -p 3000:3000 wazzy-test
```

### Testes Falhando

```bash
# Execute localmente:
npm run test:db:up
npm run test:db:migrate
npm run test:integration
npm run test:db:down
```

### Deploy Falhando

```bash
# Verifique conexão SSH:
ssh -i ~/.ssh/id_rsa user@host "echo Connected"

# Verifique logs do servidor:
ssh user@host "cd /path/to/app && docker compose logs --tail=100"
```

### Problemas com Dependências

```bash
# Limpe cache do npm:
rm -rf node_modules package-lock.json
npm install

# No CI, force reinstall:
# Adicione flag --force ao npm ci
```

## 🔐 Segurança

### Melhores Práticas

1. **Nunca comite secrets**: Use GitHub Secrets
2. **Rotacione secrets regularmente**: Especialmente chaves SSH
3. **Use tokens com escopos limitados**: Mínimo privilégio necessário
4. **Habilite 2FA**: Para todos os colaboradores
5. **Review de segurança**: Antes de mergear PRs

### Varredura de Segurança

```bash
# Execute localmente:
npm audit
npm audit fix

# Snyk scan:
npx snyk test
```

## 📚 Recursos Adicionais

- [GitHub Actions Docs](https://docs.github.com/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/deployment/deployment-guides)

## 🤝 Contribuindo

Ao fazer mudanças nos workflows:

1. Teste localmente usando [act](https://github.com/nektos/act)
2. Documente mudanças neste guia
3. Notifique a equipe sobre novas secrets/variáveis necessárias

## 📞 Suporte

Problemas com CI/CD? Abra uma issue com a label `ci/cd`.
