/**
 * metro.config.js
 * ========================
 *
 *
 * Description:
 * ------------
 * Configuración de Metro (bundler de React Native). Usa la config
 * por defecto de ``@react-native/metro-config``; se mantiene como
 * archivo aparte para poder extenderla cuando haga falta (assets
 * extra, transformers, etc.).
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
 * zxxz6       21/04/2026      Creation (scaffold RN bare 0.83)
 *
 * @format
 */

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
