/**
 * babel.config.js
 * ========================
 *
 *
 * Description:
 * ------------
 * Configuración de Babel para la app móvil de libre-chat.
 * Extiende el preset oficial de React Native
 * (``@react-native/babel-preset``) y activa
 * ``babel-plugin-module-resolver`` para mapear el alias ``@/*``
 * a ``./src/*``.
 *
 * El alias también está en ``tsconfig.json`` (sección ``paths``)
 * para el type-check, pero Metro (el bundler de RN) necesita esta
 * resolución en runtime.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.1
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       21/04/2026      Creation (scaffold RN bare 0.83 + alias @/*)
 *
 * @format
 */

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
        },
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
      },
    ],
  ],
};
