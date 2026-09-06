/**
 * Ask MediMind — the assistant chat screen.
 *
 * Three layers of "do not depend on this":
 *   1. a one-time acknowledgement the user must accept before first use
 *   2. a warning banner pinned above every conversation
 *   3. a footer on every single reply bubble
 *
 * Opened from the dashboard, or from a medicine's detail screen with
 * `?medicationId=…`, in which case the suggested questions are about that
 * medicine.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { ChatBubble } from '@/components/assistant/ChatBubble';
import {
  AppText,
  Badge,
  Button,
  Card,
  InlineMessage,
  Screen,
  TextField,
  TextLink,
} from '@/components/ui';
import { isAssistantConfigured } from '@/config/env';
import {
  ASSISTANT_ACKNOWLEDGEMENT,
  ASSISTANT_SAFETY_NOTE,
  SUGGESTED_QUESTIONS,
  suggestedQuestionsFor,
  type AssistantMessage,
} from '@/domain/assistant';
import { useAssistantStore } from '@/stores/useAssistantStore';
import { selectMedications, useMedicationStore } from '@/stores/useMedicationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme/ThemeContext';

export default function AssistantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { medicationId } = useLocalSearchParams<{ medicationId?: string }>();

  const acknowledged = useSettingsStore((s) => s.assistantDisclaimerAcknowledged);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const setSetting = useSettingsStore((s) => s.set);

  const medications = useMedicationStore(selectMedications);
  const focus = useMemo(
    () => medications.find((m) => m.id === medicationId) ?? null,
    [medications, medicationId],
  );

  const messages = useAssistantStore((s) => s.messages);
  const isThinking = useAssistantStore((s) => s.isThinking);
  const error = useAssistantStore((s) => s.error);
  const ask = useAssistantStore((s) => s.ask);
  const reset = useAssistantStore((s) => s.reset);
  const clearError = useAssistantStore((s) => s.clearError);

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<AssistantMessage>>(null);

  // AI only when the user has left demo mode AND a proxy is configured.
  const preferAi = !demoMode && isAssistantConfigured;
  const modeLabel = preferAi ? 'AI assistant' : 'Offline assistant';

  const suggestions = focus ? suggestedQuestionsFor(focus.name) : SUGGESTED_QUESTIONS;
  const hasConversation = messages.length > 1;

  useEffect(() => {
    clearError();
  }, [clearError]);

  const send = async (text: string) => {
    const question = text.trim();
    if (question.length === 0 || isThinking) return;
    setDraft('');
    await ask(question, medications, preferAi);
  };

  // ---------------------------------------------------------------------------
  // One-time acknowledgement
  // ---------------------------------------------------------------------------
  if (!acknowledged) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.xl }}>
          <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.warningSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={36}
                color={theme.colors.warningText}
              />
            </View>
            <AppText variant="title" align="center">
              Before you start
            </AppText>
          </View>

          <Card>
            <AppText variant="bodyLarge">{ASSISTANT_ACKNOWLEDGEMENT}</AppText>
          </Card>

          <InlineMessage
            tone="warning"
            title="Not medical advice"
            message="If you ever feel unwell or unsure about a medicine, contact your doctor or pharmacist — not this app."
          />

          <View style={{ gap: theme.spacing.md }}>
            <Button
              label="I understand"
              icon="checkmark"
              size="large"
              onPress={() => setSetting('assistantDisclaimerAcknowledged', true)}
              accessibilityHint="Accepts the notice and opens the assistant"
            />
            <Button label="Go back" variant="secondary" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------------
  return (
    <Screen padded={false} keyboardAvoiding edges={['left', 'right', 'bottom']}>
      <View
        style={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingTop: theme.spacing.md,
          gap: theme.spacing.sm,
        }}>
        <InlineMessage tone="warning" title="Not medical advice" message={ASSISTANT_SAFETY_NOTE} />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Badge
            label={modeLabel}
            tone={preferAi ? 'info' : 'neutral'}
            icon={preferAi ? 'sparkles-outline' : 'phone-portrait-outline'}
          />
          {hasConversation ? <TextLink label="Clear conversation" onPress={reset} /> : null}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingVertical: theme.spacing.base,
          gap: theme.spacing.md,
          flexGrow: 1,
        }}
        ListFooterComponent={
          <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
            {isThinking ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <ActivityIndicator color={theme.colors.primary} />
                <AppText variant="caption" color="textMuted">
                  Thinking…
                </AppText>
              </View>
            ) : null}

            {!hasConversation && !isThinking ? (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label" color="textMuted">
                  TRY ASKING
                </AppText>
                {suggestions.map((question) => (
                  <Pressable
                    key={question}
                    onPress={() => void send(question)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${question}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      minHeight: theme.touch.minTarget,
                      paddingHorizontal: theme.spacing.base,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.pill,
                      borderWidth: 1,
                      borderColor: theme.colors.borderStrong,
                      backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
                      alignSelf: 'flex-start',
                    })}>
                    <Ionicons name="help-circle-outline" size={18} color={theme.colors.primary} />
                    <AppText variant="body" style={{ color: theme.colors.primary }}>
                      {question}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        }
      />

      <View
        style={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.base,
          gap: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderStrong,
          backgroundColor: theme.colors.background,
        }}>
        {error ? <InlineMessage tone="danger" message={error.message} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
          <TextField
            label="Your question"
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. When does Paracetamol expire?"
            autoCapitalize="sentences"
            returnKeyType="send"
            onSubmitEditing={() => void send(draft)}
            editable={!isThinking}
            style={{ flex: 1 }}
          />
          <Button
            label="Send"
            icon="send"
            onPress={() => void send(draft)}
            disabled={draft.trim().length === 0 || isThinking}
            accessibilityHint="Sends your question to the assistant"
          />
        </View>
      </View>
    </Screen>
  );
}
