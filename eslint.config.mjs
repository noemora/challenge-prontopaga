import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Configuracion plana de ESLint 9 para todo el monorepo.
 *
 * Se aplican reglas de tipos reales (no solo sintacticas) mediante
 * `recommendedTypeChecked`, que es donde ESLint aporta valor sobre lo que ya
 * detecta el compilador: promesas sin await, comparaciones siempre verdaderas,
 * accesos inseguros a `any`.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Una variable prefijada con "_" se ignora a proposito: es la convencion
      // habitual para parametros exigidos por una firma pero no usados, como el
      // `_req` de un handler de Express.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Obliga a manejar toda promesa: una promesa olvidada en un handler de
      // Express se traduce en un error que nadie captura.
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // ── Backend ────────────────────────────────────────────────────────────────
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ── Frontend ───────────────────────────────────────────────────────────────
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ── Tests ──────────────────────────────────────────────────────────────────
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      // Los tests acceden a cuerpos de respuesta sin tipar (response.body de
      // supertest es `any`), y exigir un tipado estricto ahi no aporta
      // seguridad: aportaria ruido.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // ── Archivos de configuracion ──────────────────────────────────────────────
  {
    files: ['**/*.config.{ts,js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
    ...tseslint.configs.disableTypeChecked,
  },
);
