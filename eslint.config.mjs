import eslint from '@eslint/js';
import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const mobileRoot = 'apps/mobile';
const expoMobileConfig = expoConfig.map((config) => ({
  ...config,
  files: (config.files ?? ['**/*.{js,jsx,ts,tsx}']).map((pattern) => `${mobileRoot}/${pattern}`),
  ...(config.ignores === undefined
    ? {}
    : { ignores: config.ignores.map((pattern) => `${mobileRoot}/${pattern}`) }),
}));

export default tseslint.config(
  {
    ignores: [
      '**/.expo/**',
      '**/.pnpm-store/**',
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
    ],
  },
  eslint.configs.recommended,
  ...expoMobileConfig,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: {
        ...globals.es2023,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.es2023,
        ...globals.node,
      },
    },
  },
  prettier,
);
