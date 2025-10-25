// scripts/test-integration.js
import { execSync } from 'child_process';

try {
  execSync('npm run test:db:up', { stdio: 'inherit' });
  execSync('npm run test:db:push', { stdio: 'inherit' });
  execSync('npm run test:node', { stdio: 'inherit' }); // mesmo se falhar
} finally {
  execSync('npm run test:db:down', { stdio: 'inherit' }); // garante que o container cai
}
