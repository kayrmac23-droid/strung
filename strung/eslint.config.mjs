import nextConfig from 'eslint-config-next/core-web-vitals'

export default [
  ...nextConfig,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]
