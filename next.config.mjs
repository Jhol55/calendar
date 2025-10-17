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
    }

    return config;
  }
};

export default nextConfig;
