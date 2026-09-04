/* ============================================================
   砚墨 · 小说设计器 — ESLint 扁平配置
   ------------------------------------------------------------
   核心约束：严格禁止 any —— 代码中出现任何显式 any 都会报错，
   从类型层面与静态检查层面双重保证「不用 any」。
   ============================================================ */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        fetch: 'readonly',
        confirm: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      /* TS 负责类型检查，关掉同名基础规则避免重复报错 */
      'no-undef': 'off',
      'no-unused-vars': 'off',
      /* 严格限制 any：一旦出现即报错 */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
