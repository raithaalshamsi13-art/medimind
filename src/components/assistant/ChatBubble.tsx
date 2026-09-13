/**
 * One message in the assistant conversation, messenger-style.
 *
 * Assistant bubbles sit on the left with the MediMind mark beside them; the
 * user's sit on the right in the brand colour. Every bubble shows its time.
 *
 * Assistant bubbles carry a permanent footer — "May be wrong — check with your
 * doctor or pharmacist" — on EVERY reply, not just the first. Someone who
 * scrolls back to a single answer later should still see the caveat attached
 * to it.
 */

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { LogoMark } from '@/components/brand/Logo';
import { AppText } from '@/components/ui';
import { ASSISTANT_REPLY_FOOTER, type AssistantMessage } from '@/domain/assistant';
import { formatClockTime } from '@/lib/datetime';
import { useTheme } from '@/theme/ThemeContext';

function timeOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatClockTime(date);
}

export function ChatBubble({ message }: { message: AssistantMessage }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const time = timeOf(message.createdAt);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        gap: theme.spacing.sm,
      }}>
      {isUser ? null : (
        <View style={{ marginBottom: theme.spacing.lg }}>
          <LogoMark size={28} />
        </View>
      )}

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${isUser ? 'You' : 'Assistant'}${time ? `, ${time}` : ''}: ${message.text}`}
        style={{ maxWidth: '82%', gap: theme.spacing.xs }}>
        <View
          style={{
            backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
            borderColor: isUser ? theme.colors.primary : theme.colors.border,
            borderWidth: 1,
            borderRadius: theme.radius.xl,
            borderBottomRightRadius: isUser ? theme.radius.sm : theme.radius.xl,
            borderBottomLeftRadius: isUser ? theme.radius.xl : theme.radius.sm,
            paddingHorizontal: theme.spacing.base,
            paddingVertical: theme.spacing.md,
          }}>
          <AppText variant="body" style={{ color: isUser ? theme.colors.primaryText : theme.colors.text }}>
            {message.text}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.xs,
          }}>
          {time ? (
            <AppText variant="caption" color="textMuted">
              {time}
            </AppText>
          ) : null}
          {isUser ? null : (
            <AppText variant="caption" color="textMuted">
              · {message.source === 'ai' ? 'AI' : 'Offline'}
            </AppText>
          )}
        </View>

        {isUser ? null : (
          <View style={{ gap: theme.spacing.xxs, paddingHorizontal: theme.spacing.xs }}>
            {message.note ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs }}>
                <Ionicons name="cloud-offline-outline" size={14} color={theme.colors.textMuted} style={{ marginTop: 2 }} />
                <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {message.note}
                </AppText>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Ionicons name="alert-circle-outline" size={14} color={theme.colors.warningText} />
              <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
                {ASSISTANT_REPLY_FOOTER}
              </AppText>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
