#!/usr/bin/env node

/**
 * Script para remover logs de debug temporários
 *
 * Uso:
 * node scripts/cleanup-debug-logs.js
 */

const fs = require('fs');
const path = require('path');

const files = [
  'src/contexts/user/user-context.tsx',
  'src/lib/react-query/hooks/use-user.ts',
];

console.log('🧹 Removendo logs de debug temporários...\n');

files.forEach((filePath) => {
  const fullPath = path.join(process.cwd(), filePath);

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // Remover bloco de debug do user-context.tsx
    if (filePath.includes('user-context.tsx')) {
      content = content.replace(
        /  \/\/ Log de debug \(temporário\)[\s\S]*?  \}\, \[user\, instances\]\)\;/g,
        '',
      );
    }

    // Remover debug log do use-user.ts
    if (filePath.includes('use-user.ts')) {
      content = content.replace(
        /      \/\/ Debug log \(temporário\)[\s\S]*?      \}/g,
        '',
      );
    }

    // Limpar linhas em branco excessivas
    content = content.replace(/\n\n\n+/g, '\n\n');

    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ ${filePath}`);
    } else {
      console.log(`⚪ ${filePath} (sem mudanças)`);
    }
  } catch (error) {
    console.error(`❌ ${filePath}: ${error.message}`);
  }
});

console.log('\n✨ Limpeza concluída!');
