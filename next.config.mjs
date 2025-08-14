import webpackObfuscator from 'webpack-obfuscator';

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
            }
          }
        ]
      });
    }

    return config;
  }
};

export default nextConfig;
