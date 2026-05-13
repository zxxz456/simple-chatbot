/**
 * AppNavigator.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Stack navigator raíz. La inicial es ``Sessions`` (listado de
 * conversaciones guardadas). Las rutas ``Characters`` y
 * ``CharacterEdit`` se montan al lado para la gestión de
 * personajes con system_prompt propio.
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

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { CharacterEditScreen } from '@/screens/CharacterEditScreen';
import { CharactersScreen } from '@/screens/CharactersScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SessionEditScreen } from '@/screens/SessionEditScreen';
import { SessionsScreen } from '@/screens/SessionsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import type { RootStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Sessions"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Sessions" component={SessionsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Characters" component={CharactersScreen} />
        <Stack.Screen name="CharacterEdit" component={CharacterEditScreen} />
        <Stack.Screen name="SessionEdit" component={SessionEditScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
