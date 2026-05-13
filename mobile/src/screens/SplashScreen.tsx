/**
 * SplashScreen.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Pantalla mínima mientras hidratan store y DB. Logo grande,
 * spinner discreto debajo. Se mantiene visible muy poco — solo
 * existe para evitar el "flash" de pantalla equivocada en cold
 * starts.
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
 * zxxz6       21/04/2026      Rediseño con sparkle + paleta nueva
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

export function SplashScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.sparkle}>✦</Text>
      <Text style={styles.title}>libre-chat</Text>
      <Text style={styles.subtitle}>tu modelo, tu chat, tu dispositivo</Text>
      <ActivityIndicator
        size="small"
        color={colors.muted}
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    fontSize: 64,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.display,
    color: colors.onSurface,
    fontSize: 32,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  spinner: { marginTop: spacing.xl },
});
