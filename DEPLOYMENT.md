# 🚀 Guia de Deployment

Este documento fornece instruções rápidas para fazer deploy do projeto Wazzy.

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 20+ (para desenvolvimento)
- Acesso ao servidor de produção (via SSH)
- GitHub repository configurado

## 🏃 Quick Start

### 1. Configurar CI/CD (GitHub Actions)

```bash
# 1. Configure os secrets no GitHub
# Settings > Secrets and variables > Actions > New repository secret

# Secrets obrigatórios:
DEPLOY_HOST=seu-servidor.com
DEPLOY_USER=ubuntu
DEPLOY_SSH_KEY=<sua-chave-ssh-privada>
DEPLOY_PATH=/home/ubuntu/wazzy
```

### 2. Deploy Manual (Primeira Vez)

```bash
# No servidor de produção:
ssh user@servidor

# Clone o repositório
git clone <seu-repo> wazzy
cd wazzy

# Copie o arquivo de ambiente
cp env.example .env

# Edite as variáveis de ambiente
nano .env

# Suba os serviços
docker compose up -d

# Execute as migrations
docker compose exec app npx prisma migrate deploy

# Verifique os serviços
docker compose ps
docker compose logs -f
```

### 3. Deploy Automático (CI/CD)

Após configurar os secrets, o deploy é automático:

```bash
# Fazer mudanças
git add .
git commit -m "feat: nova funcionalidade"

# Push para main (dispara CI/CD)
git push origin main

# Ou criar uma release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## 🐳 Docker

### Build Local

```bash
# Build da aplicação
docker build -t wazzy-app .

# Build do worker
docker build -f Dockerfile.worker -t wazzy-worker .

# Rodar localmente
docker run -p 3000:3000 wazzy-app
```

### Usar Imagens do GitHub Container Registry

```bash
# Pull das imagens
docker pull ghcr.io/seu-usuario/wazzy-app:latest
docker pull ghcr.io/seu-usuario/wazzy-worker:latest

# Rodar
docker run -p 3000:3000 ghcr.io/seu-usuario/wazzy-app:latest
```

## 🔄 Workflows de Deploy

### Deploy de Produção

```bash
# Automático ao fazer push para main
git push origin main

# Ou manual via GitHub Actions
gh workflow run cd.yml
```

### Deploy de Preview (PR)

```bash
# Criar Pull Request
git checkout -b feature/nova-funcionalidade
git push origin feature/nova-funcionalidade

# GitHub Actions cria build de preview automaticamente
```

### Rollback

```bash
# No servidor
cd /path/to/app
./scripts/deploy/rollback.sh

# Ou via Docker
docker compose down
docker compose up -d --force-recreate
```

## 📦 Versionamento

Seguimos [Semantic Versioning](https://semver.org/):

```bash
# Patch (bug fixes): v1.0.1
git tag -a v1.0.1 -m "Fix: correção de bug"

# Minor (new features): v1.1.0
git tag -a v1.1.0 -m "Feat: nova funcionalidade"

# Major (breaking changes): v2.0.0
git tag -a v2.0.0 -m "Breaking: mudança incompatível"

# Push tag
git push origin --tags
```

## 🔧 Configurações de Ambiente

### Desenvolvimento

```bash
# .env.development
NODE_ENV=development
DATABASE_URL=postgresql://postgres:123456@localhost:5432/wazzy
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Produção

```bash
# .env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
SECRET_KEY=<chave-forte-aleatória>
NEXTAUTH_SECRET=<chave-forte-aleatória>
NEXT_PUBLIC_API_URL=https://seu-dominio.com/api
```

## 🏥 Health Checks

### Verificar Status dos Serviços

```bash
# Via script
./scripts/deploy/check-services.sh

# Manual
docker compose ps
docker compose logs app
docker compose logs worker

# Health endpoint
curl http://localhost:3000/api/health
```

### Monitoramento

```bash
# Logs em tempo real
docker compose logs -f

# Logs de um serviço específico
docker compose logs -f app

# Últimas 100 linhas
docker compose logs --tail=100

# Estatísticas de recursos
docker stats
```

## 🔐 Segurança

### Checklist de Segurança

- [ ] Variáveis de ambiente configuradas
- [ ] Secrets do GitHub configurados
- [ ] Chaves SSH configuradas
- [ ] Firewall configurado
- [ ] SSL/TLS configurado
- [ ] Backups automáticos configurados
- [ ] Monitoramento ativo

### Varredura de Segurança

```bash
# Executar localmente
npm audit
npm audit fix

# Snyk
npx snyk test

# Docker scan
docker scan wazzy-app
```

## 📊 Monitoramento e Logs

### Logs Centralizados

```bash
# Ver todos os logs
docker compose logs

# Filtrar por serviço
docker compose logs app
docker compose logs worker
docker compose logs postgres
docker compose logs redis

# Seguir logs em tempo real
docker compose logs -f
```

### Métricas

```bash
# Uso de recursos
docker stats

# Espaço em disco
df -h
docker system df
```

## 🆘 Troubleshooting

### Serviço não inicia

```bash
# Ver logs detalhados
docker compose logs app

# Reiniciar serviço
docker compose restart app

# Recriar serviço
docker compose up -d --force-recreate app
```

### Banco de dados com problemas

```bash
# Verificar status
docker compose exec postgres pg_isready

# Acessar console
docker compose exec postgres psql -U postgres -d calendar

# Backup
docker compose exec postgres pg_dump -U postgres calendar > backup.sql

# Restore
docker compose exec -T postgres psql -U postgres -d calendar < backup.sql
```

### Redis com problemas

```bash
# Verificar status
docker compose exec redis redis-cli ping

# Acessar console
docker compose exec redis redis-cli

# Limpar cache
docker compose exec redis redis-cli FLUSHALL
```

### Espaço em disco

```bash
# Limpar imagens não utilizadas
docker image prune -a

# Limpar tudo (cuidado!)
docker system prune -a --volumes

# Ver uso de espaço
docker system df
```

## 📚 Recursos Adicionais

- [CI/CD Guide Completo](./CI-CD-GUIDE.md)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions](https://docs.github.com/actions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)

## 🤝 Suporte

Problemas com deployment?

1. Verifique os logs: `docker compose logs`
2. Consulte o troubleshooting acima
3. Abra uma issue no GitHub
4. Entre em contato com a equipe

## 📝 Checklist de Deploy

Antes de cada deploy:

- [ ] Testes passando localmente
- [ ] Migrations criadas e testadas
- [ ] Variáveis de ambiente atualizadas
- [ ] Backup do banco de dados realizado
- [ ] Changelog atualizado
- [ ] Documentação atualizada
- [ ] Time notificado sobre o deploy
