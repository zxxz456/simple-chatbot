/**
 * App.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Componente raíz de la app móvil de libre-chat. Monta:
 *
 *   1. ``SafeAreaProvider`` — expone los insets del notch /
 *      barra de navegación a los hijos.
 *   2. ``StatusBar`` con la paleta primaria.
 *   3. Bootstrap de ``settings-store`` desde AsyncStorage al
 *      montaje. Mientras está hidratando muestra ``SplashScreen``.
 *   4. ``AppNavigator`` con el stack raíz.
 *
 * No abre ninguna DB local — toda la persistencia vive en el
 * server ``libre-chat-server`` y se accede vía ``services/api``.
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
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from '@/navigation/AppNavigator';
import { SplashScreen } from '@/screens/SplashScreen';
import { colors } from '@/constants/theme';
import { useSettingsStore } from '@/store/settings-store';

function App(): React.JSX.Element {
  const isHydrated = useSettingsStore((s) => s.isHydrated);
  const bootstrap = useSettingsStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!isHydrated) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
