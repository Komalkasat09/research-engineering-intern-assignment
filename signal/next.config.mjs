/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      // Exclude venv from module resolution to prevent symlink issues
    },
    excludeInvalidDefaultExports: true,
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/venv/**", "**/.venv/**"],
    };
    return config;
  },
};

export default nextConfig;
