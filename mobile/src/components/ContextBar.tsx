/**
 * ContextBar.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Barra fina que muestra cuánto del context window del modelo
 * está usado en la sesión actual + botón "Comprimir" cuando hay
 * suficiente conversación para resumir. Cambia de color en
 * 50% / 80%. Si hay resumen activo, lo indica con un pin verde.
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
 * zxxz6       13/05/2026      Creation
 *
 * @format
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/theme';

interface Props {
  used: number;
  total: number | null;
  hasSummary: boolean;
  canCompress: boolean;
  compressing: boolean;
  onCompress: () => void;
  onClearSummary?: () => void;
}

export function ContextBar({
  used,
  total,
  hasSummary,
  canCompress,
  compressing,
  onCompress,
  onClearSummary,
}: Props): React.JSX.Element {
  const pct =
    total !== null && total > 0 ? Math.min(100, (used / total) * 100) : 0;
  let barColor: string = colors.success;
  if (pct >= 80) {
    barColor = colors.danger;
  } else if (pct >= 50) {
    barColor = colors.warning;
  }

  const usedLabel = formatTokens(used);
  const totalLabel = total !== null ? formatTokens(total) : '?';
  const pctLabel = total !== null ? `${pct.toFixed(0)}%` : '—';

  return (
    <View style={styles.wrap}>
      <View style={styles.info}>
        <Text style={styles.label}>
          {usedLabel}
          <Text style={styles.muted}> / {totalLabel}</Text>
          <Text style={styles.pct}>  {pctLabel}</Text>
        </Text>
        {hasSummary ? (
          <TouchableOpacity onPress={onClearSummary} hitSlop={4}>
            <Text style={styles.summaryPin}>📌 resumen</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      {canCompress || compressing ? (
        <TouchableOpacity
          style={[styles.button, !canCompress && styles.buttonBusy]}
          onPress={onCompress}
          disabled={compressing || !canCompress}
        >
          {compressing ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.buttonLabel}>Comprimir</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function formatTokens(n: number): string {
  if (n < 1000) {
    return String(n);
  }
  return `${(n / 1000).toFixed(1)}k`;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 120,
  },
  label: { ...typography.caption, color: colors.onSurface, fontWeight: '600' },
  muted: { color: colors.muted, fontWeight: '400' },
  pct: { color: colors.muted, fontWeight: '500' },
  summaryPin: { ...typography.caption, color: colors.success },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBusy: { backgroundColor: colors.muted },
  buttonLabel: {
    ...typography.caption,
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
