import {
  completeProfilePromptsRequestSchema,
  PROFILE_PROMPT_ANSWER_MAX_CHARACTERS,
  PROFILE_PROMPT_ANSWER_MIN_CHARACTERS,
  PROFILE_PROMPT_ANSWER_MIN_WORDS,
  PROFILE_PROMPT_CATALOGUE,
  PROFILE_PROMPT_COUNT,
  profilePromptAnswerInputSchema,
  type ProfilePromptAnswer,
  type ProfilePromptAnswerInput,
  type ProfilePromptId,
} from '@pro-date/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import X from 'lucide-react-native/icons/x';
import { IconButton } from '../../components/icon-button';
import { TextField } from '../../components/text-field';
import { useReducedMotionPreference } from '../../theme/motion';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { OnboardingStepLayout } from './onboarding-step-layout';
import { ProfileStepFooter } from './profile-step-footer';

interface ProfilePromptsScreenProps {
  completePrompts: (prompts: ProfilePromptAnswerInput[]) => Promise<void>;
  loadPrompts: () => Promise<ProfilePromptAnswer[]>;
  onBack?: (() => void) | undefined;
}

interface PromptDraft {
  answer: string;
  promptId: ProfilePromptId | null;
}

const emptyDraft = (): PromptDraft[] =>
  Array.from({ length: PROFILE_PROMPT_COUNT }, () => ({ answer: '', promptId: null }));

function hydrateDraft(answers: ProfilePromptAnswer[]): PromptDraft[] {
  const draft = emptyDraft();

  for (const answer of answers) {
    if (draft[answer.position] !== undefined) {
      draft[answer.position] = { answer: answer.answer, promptId: answer.promptId };
    }
  }

  return draft;
}

function getPrompt(promptId: ProfilePromptId | null) {
  return PROFILE_PROMPT_CATALOGUE.find((prompt) => prompt.id === promptId);
}

function toInput(draft: PromptDraft[]): ProfilePromptAnswerInput[] {
  return draft.flatMap((item, position) =>
    item.promptId === null
      ? []
      : [{ answer: item.answer.trim(), position, promptId: item.promptId }],
  );
}

export function ProfilePromptsScreen({
  completePrompts,
  loadPrompts,
  onBack,
}: ProfilePromptsScreenProps) {
  const reducedMotion = useReducedMotionPreference();
  const [draft, setDraft] = useState<PromptDraft[]>(emptyDraft);
  const [pickerPosition, setPickerPosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);

    try {
      setDraft(hydrateDraft(await loadPrompts()));
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'We could not load your prompts.');
    } finally {
      setIsLoading(false);
    }
  }, [loadPrompts]);

  useEffect(() => {
    let isActive = true;

    void loadPrompts()
      .then((answers) => {
        if (isActive) setDraft(hydrateDraft(answers));
      })
      .catch((error: unknown) => {
        if (isActive) {
          setLoadError(error instanceof Error ? error.message : 'We could not load your prompts.');
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadPrompts]);

  const input = useMemo(() => toInput(draft), [draft]);
  const parsedDraft = completeProfilePromptsRequestSchema.safeParse({ prompts: input });
  const readyCount = draft.filter((item, position) =>
    item.promptId === null
      ? false
      : profilePromptAnswerInputSchema.safeParse({
          answer: item.answer,
          position,
          promptId: item.promptId,
        }).success,
  ).length;
  const selectedIds = new Set(
    draft.flatMap((item) => (item.promptId === null ? [] : [item.promptId])),
  );

  const selectPrompt = (promptId: ProfilePromptId) => {
    if (pickerPosition === null) return;

    setDraft((current) =>
      current.map((item, index) => (index === pickerPosition ? { answer: '', promptId } : item)),
    );
    setPickerPosition(null);
    setSaveError(null);
  };

  const complete = async () => {
    if (!parsedDraft.success || isSaving) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      await completePrompts(parsedDraft.data.prompts);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'We could not save your prompts.');
      setIsSaving(false);
    }
  };

  return (
    <>
      <OnboardingStepLayout
        current={8}
        footer={
          loadError === null ? (
            <ProfileStepFooter
              accessibilityLabel="Commit prompts and continue"
              disabled={!parsedDraft.success}
              errorMessage={saveError}
              isSaving={isSaving}
              onPress={() => void complete()}
            />
          ) : null
        }
        onBack={!isSaving ? onBack : undefined}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <AppText variant="eyebrow">Conversation hooks</AppText>
            <AppText variant="display">Give them something to reply to.</AppText>
          </View>
          <View style={styles.countPill}>
            <AppText style={styles.countText} variant="caption">
              {readyCount} / {PROFILE_PROMPT_COUNT} ready
            </AppText>
          </View>
        </View>
        <AppText style={styles.supportingText}>
          Choose three. Each answer needs five words or 30 characters—specific beats polished.
        </AppText>

        {isLoading ? (
          <View accessibilityRole="progressbar" style={styles.loadingCard}>
            <ActivityIndicator color={colors.plum} />
            <AppText style={styles.supportingText}>Fetching your prompt draft…</AppText>
          </View>
        ) : loadError === null ? (
          <View style={styles.promptList}>
            {draft.map((item, position) => {
              const prompt = getPrompt(item.promptId);
              const isAnswerValid =
                item.promptId !== null &&
                profilePromptAnswerInputSchema.safeParse({
                  answer: item.answer,
                  position,
                  promptId: item.promptId,
                }).success;

              return (
                <View key={position} style={styles.promptCard}>
                  <View style={styles.promptMeta}>
                    <AppText style={styles.slotLabel} variant="eyebrow">
                      Prompt {position + 1}
                    </AppText>
                    {prompt === undefined ? null : (
                      <AppText style={styles.category} variant="caption">
                        {prompt.category}
                      </AppText>
                    )}
                  </View>
                  <Pressable
                    accessibilityLabel={
                      prompt === undefined
                        ? `Choose prompt ${position + 1}`
                        : `Change prompt ${position + 1}`
                    }
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() => setPickerPosition(position)}
                    style={({ pressed }) => [styles.selector, pressed && styles.selectorPressed]}
                  >
                    <AppText style={prompt === undefined ? styles.placeholder : styles.question}>
                      {prompt?.text ?? 'Choose a conversation starter'}
                    </AppText>
                    <ChevronRight size={20} color={colors.plum} />
                  </Pressable>
                  {prompt === undefined ? null : (
                    <>
                      <TextField
                        accessibilityHint="Enter at least five words or 30 characters. Use Done to close the keyboard."
                        accessibilityLabel={`Answer prompt ${position + 1}`}
                        editable={!isSaving}
                        maxLength={PROFILE_PROMPT_ANSWER_MAX_CHARACTERS}
                        multiline
                        onChangeText={(answer) =>
                          setDraft((current) =>
                            current.map((currentItem, index) =>
                              index === position ? { ...currentItem, answer } : currentItem,
                            ),
                          )
                        }
                        onSubmitEditing={Keyboard.dismiss}
                        placeholder="Write the answer only you could write…"
                        placeholderTextColor={colors.muted}
                        returnKeyType="done"
                        scrollEnabled
                        selectionColor={colors.plum}
                        style={styles.answerInput}
                        submitBehavior="blurAndSubmit"
                        textAlignVertical="top"
                        value={item.answer}
                      />
                      <AppText
                        accessibilityLiveRegion="polite"
                        style={isAnswerValid ? styles.validGuidance : styles.guidance}
                        variant="caption"
                      >
                        {isAnswerValid
                          ? 'Ready'
                          : `Keep going · ${PROFILE_PROMPT_ANSWER_MIN_WORDS} words or ${PROFILE_PROMPT_ANSWER_MIN_CHARACTERS} characters`}
                      </AppText>
                      <AppText style={styles.guidance} variant="caption">
                        {item.answer.length} / {PROFILE_PROMPT_ANSWER_MAX_CHARACTERS}
                      </AppText>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View accessibilityRole="alert" accessible style={styles.errorCard}>
            <AppText style={styles.errorTitle} variant="title">
              Prompt lane unavailable
            </AppText>
            <AppText style={styles.errorText}>{loadError}</AppText>
            <AppButton label="Retry loading prompts" onPress={() => void refresh()} />
          </View>
        )}
      </OnboardingStepLayout>

      <Modal
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setPickerPosition(null)}
        presentationStyle="pageSheet"
        visible={pickerPosition !== null}
      >
        <Screen style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <AppText variant="eyebrow">Curated, not crowded</AppText>
              <AppText variant="title">Choose prompt {(pickerPosition ?? 0) + 1}</AppText>
            </View>
            <IconButton
              label="Close prompt picker"
              icon={X}
              onPress={() => setPickerPosition(null)}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.catalogue}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {PROFILE_PROMPT_CATALOGUE.map((prompt) => {
              const isCurrent =
                pickerPosition === null ? false : draft[pickerPosition]?.promptId === prompt.id;
              const isUsedElsewhere = selectedIds.has(prompt.id) && !isCurrent;

              return (
                <Pressable
                  accessibilityLabel={prompt.text}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isUsedElsewhere, selected: isCurrent }}
                  disabled={isUsedElsewhere}
                  key={prompt.id}
                  onPress={() => selectPrompt(prompt.id)}
                  style={({ pressed }) => [
                    styles.catalogueItem,
                    isCurrent && styles.catalogueItemSelected,
                    isUsedElsewhere && styles.catalogueItemDisabled,
                    pressed && styles.selectorPressed,
                  ]}
                >
                  <AppText style={styles.category} variant="caption">
                    {prompt.category}
                  </AppText>
                  <AppText style={styles.catalogueQuestion}>{prompt.text}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </Screen>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  answerInput: {
    backgroundColor: colors.background,
    borderColor: colors.fieldBorder,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.family.body,
    fontSize: typography.size.body,
    lineHeight: 24,
    minHeight: 112,
    padding: spacing.md,
  },
  catalogue: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  catalogueItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 88,
    padding: spacing.md,
  },
  catalogueItemDisabled: {
    opacity: 0.4,
  },
  catalogueItemSelected: {
    backgroundColor: colors.plumSoft,
    borderColor: colors.plum,
  },
  catalogueQuestion: {
    fontFamily: typography.family.medium,
    lineHeight: 23,
  },
  category: {
    flexShrink: 1,
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countText: {
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    gap: spacing.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 21,
  },
  guidance: {
    color: colors.muted,
    textAlign: 'right',
  },
  headingCopy: {
    gap: spacing.sm,
  },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 220,
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  modalScreen: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  placeholder: {
    color: colors.muted,
    flex: 1,
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  promptList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  promptMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  question: {
    flex: 1,
    fontFamily: typography.family.medium,
    lineHeight: 23,
  },
  selector: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  selectorPressed: {
    opacity: 0.72,
  },
  slotLabel: {
    color: colors.muted,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 360,
  },
  validGuidance: {
    color: colors.plum,
    textAlign: 'right',
  },
});
