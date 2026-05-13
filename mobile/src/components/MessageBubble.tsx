/**
 * MessageBubble.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Burbuja de chat estilo WhatsApp:
 *
 *   * Mensajes del **usuario**: alineados a la derecha, burbuja
 *     color primario con texto blanco. Sin avatar (es obvio que
 *     es uno mismo).
 *   * Mensajes del **assistant / personaje**: alineados a la
 *     izquierda con avatar circular pegado al margen. Nombre del
 *     emisor en negrita arriba de la burbuja con el color del
 *     personaje (o primary en modo clásico). Burbuja blanca con
 *     borde sutil.
 *
 * Esquina-tail recortada en cada burbuja (top-left para asistente,
 * bottom-right para usuario) para ese look de "conversación
 * dirigida".
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.4
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Rediseño estilo WhatsApp (burbujas left/right)
 * zxxz6       13/05/2026      Soporte de personajes (avatar coloreado + nombre)
 * zxxz6       21/04/2026      Rediseño Claude/DeepSeek-style (no más burbujas)
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { ThinkingBlock } from '@/components/ThinkingBlock';
import { colors, radii, spacing, typography } from '@/constants/theme';
import type { UiMessage } from '@/store/chat-store';
import type { Character } from '@/types/db';

interface Props {
  message: UiMessage;
  modelLabel: string;
  /** Personaje que emitió este mensaje (sólo para ``assistant``). */
  character?: Character | null;
  /** Long-press en la burbuja (rebobinar conversación). */
  onLongPress?: () => void;
}

export function MessageBubble({
  message,
  modelLabel,
  character,
  onLongPress,
}: Props): React.JSX.Element {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={styles.rowUser}>
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={400}
          style={styles.bubbleUser}
        >
          <RichText text={message.content} style={styles.textUser} selectable />
        </Pressable>
      </View>
    );
  }

  // assistant / personaje
  let senderName: string;
  let senderColor: string;
  let avatarLetter: string;
  let avatarColor: string;

  if (character) {
    senderName = character.name;
    senderColor = character.color;
    avatarLetter = character.avatar;
    avatarColor = character.color;
  } else if (message.characterId != null) {
    senderName = 'Personaje eliminado';
    senderColor = colors.muted;
    avatarLetter = '?';
    avatarColor = colors.muted;
  } else {
    senderName = modelLabel;
    senderColor = colors.primary;
    avatarLetter = '✦';
    avatarColor = colors.assistantAvatar;
  }

  const tps =
    message.outputTokens && message.evalDurationNs
      ? (message.outputTokens / (message.evalDurationNs / 1e9)).toFixed(1)
      : null;

  return (
    <View style={styles.rowAssistant}>
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText} numberOfLines={1}>
          {avatarLetter}
        </Text>
      </View>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        style={styles.bubbleAssistant}
      >
        <Text style={[styles.senderName, { color: senderColor }]} numberOfLines={1}>
          {senderName}
        </Text>
        {message.thinking ? (
          <View style={styles.thinkingWrap}>
            <ThinkingBlock text={message.thinking} />
          </View>
        ) : null}
        <RichText
          text={message.content || '…'}
          style={styles.textAssistant}
          selectable
        />
        {message.outputTokens ? (
          <Text style={styles.stats}>
            {message.outputTokens} tok{tps ? ` · ${tps}/s` : ''}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const AVATAR_SIZE = 30;
const BUBBLE_MAX_WIDTH = '78%';
const TAIL_RADIUS = 4;
const BUBBLE_RADIUS = 16;

const styles = StyleSheet.create({
  rowUser: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    alignItems: 'flex-end',
  },
  rowAssistant: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  avatarText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  bubbleUser: {
    maxWidth: BUBBLE_MAX_WIDTH,
    backgroundColor: colors.primary,
    borderRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: TAIL_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleAssistant: {
    flexShrink: 1,
    maxWidth: BUBBLE_MAX_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: BUBBLE_RADIUS,
    borderTopLeftRadius: TAIL_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textUser: {
    ...typography.body,
    color: colors.onPrimary,
  },
  textAssistant: {
    ...typography.body,
    color: colors.onSurface,
  },
  senderName: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: 2,
  },
  thinkingWrap: {
    marginBottom: spacing.xs,
  },
  stats: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
    fontSize: 11,
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _: unknown = radii; // mantener import disponible para futuras tweaks
