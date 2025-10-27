# 🚀 Quick Start - CI/CD em 5 Minutos

Este guia ajuda você a configurar CI/CD rapidamente.

## ⚡ Setup Rápido

### Passo 1: Configure GitHub Secrets (2 min)

Acesse: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Adicione estes 4 secrets:

```bash
DEPLOY_HOST         # Ex: 123.45.67.89
DEPLOY_USER         # Ex: ubuntu
DEPLOY_SSH_KEY      # Cole sua chave SSH privada completa
DEPLOY_PATH         # Ex: /home/ubuntu/wazzy
```

<details>
<summary>💡 Como obter a chave SSH?</summary>

```bash
# Gerar nova chave (se não tiver)
ssh-keygen -t rsa -b 4096 -C "deploy@wazzy"

# Ver conteúdo da chave privada
cat ~/.ssh/id_rsa

# Copie TODO o conteúdo (incluindo BEGIN e END)
```

</details>

### Passo 2: Primeiro Deploy Manual no Servidor (3 min)

```bash
# Conecte ao servidor
ssh user@seu-servidor

# Clone o repositório
git clone https://github.com/seu-usuario/wazzy.git
cd wazzy

# Configure ambiente
cp env.example .env
nano .env  # Edite: DATABASE_URL, SECRET_KEY, etc

# Suba os serviços
docker compose up -d

# Execute migrations
docker compose exec app npx prisma migrate deploy

# Pronto! ✅
```

### Passo 3: Ative Deploy Automático (Instantâneo!)

Agora todo commit na branch `main` dispara deploy automático:

```bash
git add .
git commit -m "feat: minha alteração"
git push origin main

# ✅ CI/CD faz automaticamente:
# - Testes
# - Build
# - Deploy
# - Health check
```

Acompanhe em: `Actions` tab no GitHub

## 📋 Checklist de Configuração

- [ ] Secrets configurados no GitHub
- [ ] Servidor com Docker instalado
- [ ] Primeira aplicação rodando no servidor
- [ ] `.env` configurado no servidor
- [ ] Testou um push para main

## 🎯 Comandos Úteis

### No Servidor

```bash
# Ver status
docker compose ps

# Ver logs
docker compose logs -f

# Restart
docker compose restart app

# Backup do banco
docker compose exec postgres pg_dump -U postgres calendar > backup.sql
```

### No GitHub

```bash
# Criar release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Trigger deploy manual
gh workflow run cd.yml
```

## 🔍 Verificar se Está Funcionando

### 1. CI está funcionando?

- Crie um Pull Request
- Veja aba `Actions`
- Deve aparecer workflow "CI" rodando
- Espere terminar (8-12 min)

### 2. CD está funcionando?

- Faça push para `main`
- Veja aba `Actions`
- Deve aparecer workflow "CD" rodando
- Espere terminar (10-15 min)
- Acesse sua aplicação

### 3. App está saudável?

```bash
# Localmente
curl http://localhost:3000/api/health

# Produção
curl https://seu-dominio.com/api/health

# Deve retornar:
# {"status":"healthy","timestamp":"..."}
```

## 🆘 Problemas Comuns

### ❌ CI falhando

```bash
# Teste localmente primeiro
npm run lint
npm run test:jsdom
npm run build
```

### ❌ Deploy falhando

Verifique:

1. Secrets configurados corretamente?
2. Servidor acessível via SSH?
3. Docker instalado no servidor?
4. Portas liberadas no firewall?

```bash
# Teste conexão SSH
ssh -i ~/.ssh/id_rsa user@servidor "echo OK"
```

### ❌ App não inicia

```bash
# No servidor, veja logs
docker compose logs app

# Problemas comuns:
# - Variáveis de ambiente faltando
# - Porta já em uso
# - Banco de dados não conectando
```

## 📚 Documentação Completa

| Arquivo                              | O Que Contém    |
| ------------------------------------ | --------------- |
| [`CI-CD-SETUP.md`](./CI-CD-SETUP.md) | Resumo completo |
| [`CI-CD-GUIDE.md`](./CI-CD-GUIDE.md) | Guia detalhado  |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md)   | Troubleshooting |

## 💡 Próximos Passos

Após configurar o básico:

1. **Configure notificações** (Slack/Discord)
2. **Adicione staging environment**
3. **Configure monitoramento** (Sentry)
4. **Habilite backups automáticos**

## 🎉 Pronto!

Seu CI/CD está configurado!

Agora todo push para `main` vai:

- ✅ Rodar testes automaticamente
- ✅ Fazer build
- ✅ Criar imagem Docker
- ✅ Fazer deploy
- ✅ Verificar saúde da aplicação

**Relaxe e deixe o CI/CD trabalhar para você! 🚀**

---

_Dúvidas? Abra uma issue ou consulte os guias detalhados._
