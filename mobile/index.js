/**
 * index.js
 * ========================
 *
 *
 * Description:
 * ------------
 * Punto de entrada de la app móvil. Registra el componente raíz
 * ``App`` en el ``AppRegistry`` de React Native bajo el nombre
 * declarado en ``app.json`` (``LibreChatMobile``).
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

import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
