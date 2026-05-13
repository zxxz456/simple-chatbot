/**
 * Composer.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Input multilínea + botón circular de enviar. Estilo Claude:
 * tarjeta blanca con borde sutil, esquinas muy redondeadas, el
 * botón "↑" en la esquina inferior derecha.
 *
 * El texto se mantiene en el padre (``ChatScreen`` posee el
 * estado) — así un long-press que abra un picker no pierde el
 * texto si el usuario cancela.
 *
 * Interacciones:
 *
 *   * **Tap** en el botón → ``onSend()`` (el padre decide
 *     quiénes responden; por defecto todos los personajes
 *     activos o el assistant clásico).
 *   * **Long-press** en el botón → ``onLongPress()`` (el padre
 *     abre un picker para elegir quién responde). Sólo activo
 *     si ``canChooseSpeaker``.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.3
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Long-press → picker de hablante; texto controlado
 * zxxz6       21/04/2026      Rediseño con card + botón circular
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/theme';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  disabled: boolean;
  /** ``true`` cuando hay personajes activos en la sesión. */
  canChooseSpeaker: boolean;
  onSend: () => void;
  onLongPress: () => void;
}

export function Composer({
  value,
  onChangeText,
  disabled,
  canChooseSpeaker,
  onSend,
  onLongPress,
}: Props): React.JSX.Element {
  const hasText = value.trim().length > 0;
  // El botón está activo si: hay texto, o hay personajes activos.
  // En el segundo caso el tap abre el picker para elegir quién
  // responde — útil incluso al inicio para que un personaje
  // arranque la escena.
  const canAct = !disabled && (hasText || canChooseSpeaker);
  const canLongPress = !disabled && canChooseSpeaker;

  const handleTap = () => {
    if (!canAct) {
      return;
    }
    onSend();
  };

  const handleLongPress = () => {
    if (!canLongPress) {
      return;
    }
    onLongPress();
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, disabled && styles.cardDisabled]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={
            canChooseSpeaker && !hasText
              ? 'Toca ↑ para que un personaje hable…'
              : 'Escribe un mensaje…'
          }
          placeholderTextColor={colors.muted}
          multiline
          editable={!disabled}
        />
        <TouchableOpacity
          style={[styles.send, !canAct && styles.sendDisabled]}
          onPress={handleTap}
          onLongPress={handleLongPress}
          delayLongPress={300}
          disabled={!canAct && !canLongPress}
          accessibilityLabel="Enviar mensaje"
          accessibilityHint={
            canChooseSpeaker ? 'Mantén presionado para elegir quién responde' : undefined
          }
        >
          {disabled ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.sendIcon}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BUTTON_SIZE = 36;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 52,
  },
  cardDisabled: { backgroundColor: colors.surfaceAlt },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 36,
    maxHeight: 160,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    color: colors.onSurface,
  },
  send: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    alignSelf: 'flex-end',
    marginBottom: spacing.xs,
  },
  sendDisabled: { backgroundColor: colors.border },
  sendIcon: {
    color: colors.onPrimary,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
});
