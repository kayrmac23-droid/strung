import nextConfig from 'eslint-config-next/core-web-vitals'
import typescriptEslint from '@typescript-eslint/eslint-plugin'

export default [
  ...nextConfig,
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]
