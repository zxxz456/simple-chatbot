/**
 * navigation.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Tipado del native-stack de navegación. Cada entrada de
 * ``RootStackParamList`` declara una ruta y el shape de
 * ``route.params``.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.2
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Added Characters + CharacterEdit routes
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Rutas del stack raíz.
 */
export type RootStackParamList = {
  Splash: undefined;
  Sessions: undefined;
  Chat: { sessionId?: number } | undefined;
  Settings: undefined;
  Characters: undefined;
  CharacterEdit: { characterId?: number } | undefined;
  SessionEdit: undefined;
};

/**
 * Props tipadas para una pantalla del stack raíz.
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
