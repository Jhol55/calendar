// scripts/tests/integration.js
import { execSync } from 'child_process';

console.log('\n🧪 Rodando testes de integração\n');

try {
  execSync('npm run test:db:up', { stdio: 'inherit' });
  execSync('npm run test:db:push', { stdio: 'inherit' });
  execSync('npm run test:node', { stdio: 'inherit' });
} finally {
  execSync('npm run test:db:down', { stdio: 'inherit' }); // garante que o container cai
}
