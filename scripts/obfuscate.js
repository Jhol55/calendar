import { execSync } from 'child_process';
import { join } from 'path';
import fs from 'fs';

const outputPath = join(process.cwd(), '.next');
const obfuscateTargets = [
  join(outputPath, 'static', 'chunks'),
  join(outputPath, 'server', 'chunks'),
  join(outputPath, 'server', 'app'),
];

const obfuscateDirectory = (dir) => {
  if (fs.existsSync(dir)) {
    console.log(`Obfuscating files in: ${dir}`);
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        obfuscateDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          console.log(`- Obfuscating: ${fullPath}`);
          execSync(
            `npx javascript-obfuscator ${fullPath} --output ${fullPath} --compact true --control-flow-flattening true --control-flow-flattening-threshold 1 --string-array true --string-array-threshold 1 --string-array-encoding base64 --dead-code-injection true --dead-code-injection-threshold 1`,
            { stdio: 'inherit' },
          );
        } catch (err) {
          console.error(
            `❌ Obfuscation failed for file: ${fullPath}. Details:`,
            err,
          );
        }
      }
    }
  }
};

console.log('🚀 Starting post-build obfuscation...');
obfuscateTargets.forEach(obfuscateDirectory);
console.log('✅ Post-build obfuscation complete!');
