/**
 * Ask MediMind — the assistant, as a chat.
 *
 * Three layers of "do not depend on this":
 *   1. a one-time acknowledgement the user must accept before first use
 *   2. a warning line pinned above every conversation
 *   3. a footer on every single reply bubble
 *
 * Lives in the bottom tab bar as "Ask". A medicine's detail screen can also
 * open it with `?medicationId=…`, in which case the quick replies are about
 * that medicine.
 *
 * The AI answers whenever the server is configured (Demo Mode only affects
 * the scanner); if the AI cannot be reached the store falls back to the
 * offline assistant and the bubble says so. The conversation lives in the
 * store, so switching tabs and coming back keeps it; it is never persisted to
 * disk.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';

import { ChatBubble } from '@/components/assistant/ChatBubble';
import { TypingIndicator } from '@/components/assistant/TypingIndicator';
import { LogoMark } from '@/components/brand/Logo';
import { MemberContextBanner } from '@/components/family/MemberContextBanner';
import { AppText, Button, Card, InlineMessage, Screen } from '@/components/ui';
import { isAssistantConfigured } from '@/config/env';
import {
  ASSISTANT_ACKNOWLEDGEMENT,
  ASSISTANT_SAFETY_NOTE,
  MAX_QUESTION_LENGTH,
  SUGGESTED_QUESTIONS,
  suggestedQuestionsFor,
  toPersonContext,
  type AssistantMessage,
} from '@/domain/assistant';
import { useAssistantStore } from '@/stores/useAssistantStore';
import {
  forMember,
  memberById,
  selectActiveMemberId,
  selectMembers,
  useFamilyStore,
} from '@/stores/useFamilyStore';
import { selectConditions, useHealthConditionStore } from '@/stores/useHealthConditionStore';
import { selectMedications, useMedicationStore } from '@/stores/useMedicationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme/ThemeContext';

export default function AssistantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { medicationId } = useLocalSearchParams<{ medicationId?: string }>();

  const acknowledged = useSettingsStore((s) => s.assistantDisclaimerAcknowledged);
  const setSetting = useSettingsStore((s) => s.set);

  const allMedications = useMedicationStore(selectMedications);
  const members = useFamilyStore(selectMembers);
  const activeMemberId = useFamilyStore(selectActiveMemberId);
  const focus = useMemo(
    () => allMedications.find((m) => m.id === medicationId) ?? null,
    [allMedications, medicationId],
  );
  // The assistant only ever sees ONE family member's medicines: the medicine
  // it was opened for, otherwise the member being managed. Mixing two
  // people's medicines into one answer would be exactly the confusion the
  // Family feature exists to prevent.
  const memberId = focus?.memberId ?? activeMemberId;
  const member = useMemo(() => memberById(members, memberId), [members, memberId]);
  const medications = useMemo(
    () => forMember(allMedications, memberId),
    [allMedications, memberId],
  );
  // That person's health profile and conditions, as context only.
  const allConditions = useHealthConditionStore(selectConditions);
  const person = useMemo(
    () => (member ? toPersonContext(member, allConditions) : null),
    [member, allConditions],
  );

  const messages = useAssistantStore((s) => s.messages);
  const isThinking = useAssistantStore((s) => s.isThinking);
  const error = useAssistantStore((s) => s.error);
  const ask = useAssistantStore((s) => s.ask);
  const reset = useAssistantStore((s) => s.reset);
  const clearError = useAssistantStore((s) => s.clearError);

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<AssistantMessage>>(null);

  // AI whenever a server is configured. Demo Mode only affects the scanner.
  const preferAi = isAssistantConfigured;

  const suggestions = useMemo(() => {
    if (focus) return suggestedQuestionsFor(focus.name);
    const first = medications[0];
    return first
      ? [...SUGGESTED_QUESTIONS.slice(0, 3), `What is ${first.name} usually used for?`]
      : SUGGESTED_QUESTIONS;
  }, [focus, medications]);
  const hasConversation = messages.length > 1;

  useEffect(() => {
    clearError();
  }, [clearError]);

  const send = async (text: string) => {
    const question = text.trim();
    if (question.length === 0 || isThinking) return;
    setDraft('');
    await ask(question, medications, person, preferAi);
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
            <Button label="Not now" variant="secondary" onPress={() => router.replace('/')} />
          </View>
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------------
  const canSend = draft.trim().length > 0 && !isThinking;

  return (
    <Screen padded={false} keyboardAvoiding>
      {/* ---------- Chat header ---------- */}
      <View
        style={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <LogoMark size={44} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="subheading">MediMind Assistant</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: theme.radius.pill,
                  backgroundColor: preferAi ? theme.colors.success : theme.colors.textMuted,
                }}
              />
              <AppText variant="caption" color="textSecondary">
                {preferAi ? 'AI chat · falls back to offline answers' : 'Offline · reads your records back'}
              </AppText>
            </View>
          </View>
          {hasConversation ? (
            <Pressable
              onPress={reset}
              accessibilityRole="button"
              accessibilityLabel="Start a new conversation"
              hitSlop={8}
              style={({ pressed }) => ({
                width: theme.touch.minTarget,
                height: theme.touch.minTarget,
                borderRadius: theme.radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
              })}>
              <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {member && !member.isSelf ? (
          <MemberContextBanner
            member={member}
            prefix="Chatting about medicines for"
            onChange={() => router.push('/family')}
          />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs }}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warningText} style={{ marginTop: 2 }} />
          <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
            {ASSISTANT_SAFETY_NOTE}
          </AppText>
        </View>
      </View>

      {/* ---------- Messages ---------- */}
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
          gap: theme.spacing.base,
          flexGrow: 1,
        }}
        ListFooterComponent={
          isThinking ? (
            <View style={{ paddingTop: theme.spacing.xs }}>
              <TypingIndicator />
            </View>
          ) : null
        }
      />

      {/* ---------- Quick replies + composer ---------- */}
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.base,
          gap: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderStrong,
          backgroundColor: theme.colors.background,
        }}>
        {error ? (
          <View style={{ paddingHorizontal: theme.layout.screenPadding }}>
            <InlineMessage tone="danger" message={error.message} />
          </View>
        ) : null}

        {!isThinking ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: theme.layout.screenPadding,
              gap: theme.spacing.sm,
            }}>
            {suggestions.map((question) => (
              <Pressable
                key={question}
                onPress={() => void send(question)}
                accessibilityRole="button"
                accessibilityLabel={`Ask: ${question}`}
                style={({ pressed }) => ({
                  minHeight: theme.touch.minTarget,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing.base,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: theme.colors.primary,
                  backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
                })}>
                <AppText variant="label" color="primary">
                  {question}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.layout.screenPadding,
          }}>
          <View
            style={{
              flex: 1,
              minHeight: theme.touch.comfortable,
              maxHeight: 140,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radius.xl + 6,
              borderWidth: 2,
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
            }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message MediMind…"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={MAX_QUESTION_LENGTH}
              autoCapitalize="sentences"
              autoCorrect
              editable={!isThinking}
              accessibilityLabel="Message"
              accessibilityHint="Type a question about your saved medicines"
              allowFontScaling
              style={{
                color: theme.colors.text,
                fontSize: theme.type.body.fontSize,
                lineHeight: theme.type.body.lineHeight,
                paddingVertical: theme.spacing.md,
                maxHeight: 120,
              }}
            />
          </View>
          <Pressable
            onPress={() => void send(draft)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => ({
              width: theme.touch.comfortable,
              height: theme.touch.comfortable,
              borderRadius: theme.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend
                ? pressed
                  ? theme.colors.primaryPressed
                  : theme.colors.primary
                : theme.colors.surfaceAlt,
              opacity: canSend ? 1 : 0.7,
            })}>
            <Ionicons name="send" size={22} color={canSend ? theme.colors.primaryText : theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
