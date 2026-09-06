/**
 * One message in the assistant conversation.
 *
 * Assistant bubbles carry a permanent footer — "May be wrong — check with your
 * doctor or pharmacist" — on EVERY reply, not just the first. Someone who
 * scrolls back to a single answer later should still see the caveat attached
 * to it.
 */

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { ASSISTANT_REPLY_FOOTER, type AssistantMessage } from '@/domain/assistant';
import { useTheme } from '@/theme/ThemeContext';

export function ChatBubble({ message }: { message: AssistantMessage }) {
  const theme = useTheme();
  const isUser = message.role === 'user';

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${isUser ? 'You' : 'Assistant'}: ${message.text}`}
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        gap: theme.spacing.xs,
      }}>
      <View
        style={{
          backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
          borderColor: isUser ? theme.colors.primary : theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radius.lg,
          borderBottomRightRadius: isUser ? theme.radius.sm : theme.radius.lg,
          borderBottomLeftRadius: isUser ? theme.radius.lg : theme.radius.sm,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.md,
        }}>
        <AppText variant="body" style={{ color: isUser ? theme.colors.primaryText : theme.colors.text }}>
          {message.text}
        </AppText>
      </View>

      {isUser ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.xs }}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.colors.warningText} />
          <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
            {ASSISTANT_REPLY_FOOTER}
            {message.source === 'ai' ? ' · AI answer' : ' · Offline answer'}
          </AppText>
        </View>
      )}
    </View>
  );
}
