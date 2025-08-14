import webpackObfuscator from 'webpack-obfuscator';
import TerserPlugin from 'terser-webpack-plugin';
import { execSync } from 'child_process';
import { join } from 'path';
import fs from 'fs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      config.module.rules.push({
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        enforce: 'post',
        use: [
          {
            loader: webpackObfuscator.loader,
            options: {
              compact: true,
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 1,
              stringArray: true,
              stringArrayEncoding: ['base64'],
              stringArrayThreshold: 1,
              deadCodeInjection: true,
              deadCodeInjectionThreshold: 1,
              simplify: true,
              splitStrings: true,
            },
          },
        ],
      });

      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            compress: {
              passes: 3,
              drop_console: true,
              drop_debugger: true
            },
            mangle: {
              toplevel: true
            },
            output: {
              comments: false
            }
          }
        })
      ];

      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.afterEmit.tap('PostBuildObfuscation', () => {
            const outputPath = compiler.options.output.path;
            const obfuscateTargets = [
              join(outputPath, 'static', 'chunks'),
              join(outputPath, 'server', 'chunks'),
              join(outputPath, 'server', 'app')
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
                        { stdio: 'inherit' }
                      );
                    } catch (err) {
                      console.error(`❌ Obfuscation failed for file: ${fullPath}. Details:`, err);
                    }
                  }
                }
              }
            };

            obfuscateTargets.forEach(obfuscateDirectory);
          });
        }
      });

    }

    return config;
  }
};

export default nextConfig;
