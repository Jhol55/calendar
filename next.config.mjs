import webpackObfuscator from 'webpack-obfuscator';
import TerserPlugin from 'terser-webpack-plugin';


/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pps.whatsapp.net',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config, { isServer }) => {
    // Excluir Playwright do bundle do cliente (server-only)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
      
      // Excluir playwright e suas dependências do bundle do cliente
      config.externals = config.externals || [];
      config.externals.push({
        playwright: 'commonjs playwright',
        'playwright-core': 'commonjs playwright-core',
        'chromium-bidi': 'commonjs chromium-bidi',
        'better-playwright-mcp3': 'commonjs better-playwright-mcp3',
      });
      
      // Ignorar módulos problemáticos durante análise estática
      config.module = config.module || {};
      config.module.unknownContextCritical = false;
      config.module.unknownContextRegExp = /^\.\/.*$/;
    }
    
    // SEMPRE excluir playwright do bundle (mesmo no servidor durante análise estática)
    // Isso previne que o Next.js tente fazer bundle desses pacotes
    const externalPackages = {
      playwright: 'commonjs playwright',
      'playwright-core': 'commonjs playwright-core',
      'chromium-bidi': 'commonjs chromium-bidi',
      'better-playwright-mcp3': 'commonjs better-playwright-mcp3',
    };
    
    // Configurar externals
    if (!config.externals) {
      config.externals = [];
    }
    if (Array.isArray(config.externals)) {
      config.externals.push(externalPackages);
    } else if (typeof config.externals === 'object') {
      Object.assign(config.externals, externalPackages);
    }
    
    // Ignorar avisos de dependências dinâmicas
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /playwright/ },
      { module: /better-playwright-mcp3/ },
    ];
    
    // Configurar para não tentar resolver módulos playwright durante análise estática
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    // Adicionar regra para ignorar playwright durante análise
    config.module = config.module || {};
    config.module.unknownContextCritical = false;

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
    }

    return config;
  }
};

export default nextConfig;
