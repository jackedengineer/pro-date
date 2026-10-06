import { DateTimePicker as ExpoDateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors } from '../../theme/tokens';
import { styles } from './birthday-screen.styles';
import { OnboardingProgress } from './onboarding-progress';

interface BirthdayScreenProps {
  onBack?: (() => void) | undefined;
  onSave: (birthDate: string) => Promise<void>;
  today?: Date;
}

function subtractCalendarYears(date: Date, years: number): Date {
  const targetYear = date.getFullYear() - years;
  const lastDayOfTargetMonth = new Date(targetYear, date.getMonth() + 1, 0).getDate();

  return new Date(
    targetYear,
    date.getMonth(),
    Math.min(date.getDate(), lastDayOfTargetMonth),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

export function getLatestEligibleBirthDate(today: Date): Date {
  return subtractCalendarYears(today, 18);
}

export function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function BirthdayScreen({ onBack, onSave, today = new Date() }: BirthdayScreenProps) {
  const [birthDate, setBirthDate] = useState(() => subtractCalendarYears(today, 25));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSelectedDate, setHasSelectedDate] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(Platform.OS === 'ios');
  const [isSaving, setIsSaving] = useState(false);
  const formattedBirthDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
    birthDate,
  );

  const save = async () => {
    if (isSaving || !hasSelectedDate) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave(toCalendarDate(birthDate));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'We could not save your birthday. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {onBack === undefined ? null : (
            <Pressable
              accessibilityLabel="Back to name"
              accessibilityRole="button"
              disabled={isSaving}
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <AppText style={styles.backIcon} variant="title">
                ←
              </AppText>
            </Pressable>
          )}
          <View style={styles.progress}>
            <OnboardingProgress current={2} total={9} />
          </View>
        </View>

        <View style={styles.content}>
          <AppText variant="eyebrow">Profile config</AppText>
          <AppText variant="display">One quick age check.</AppText>
          <AppText style={styles.supportingText}>
            ProDate is 18+. We verify that rule on our servers.
          </AppText>

          <View style={styles.privacyCard}>
            <AppText style={styles.privacyTitle} variant="caption">
              Private field
            </AppText>
            <AppText>
              Your full birthday stays private. Only your age appears on your profile.
            </AppText>
          </View>

          <View style={styles.dateCard}>
            <AppText variant="caption">Birthday input</AppText>
            <AppText
              accessibilityLabel={`Selected birthday ${formattedBirthDate}`}
              style={styles.dateValue}
              variant="title"
            >
              {formattedBirthDate}
            </AppText>

            {Platform.OS === 'ios' || isPickerVisible ? (
              <ExpoDateTimePicker
                accentColor={colors.plum}
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                maximumDate={getLatestEligibleBirthDate(today)}
                minimumDate={new Date(1900, 0, 1)}
                mode="date"
                negativeButton={{ label: 'Cancel' }}
                onDismiss={() => setIsPickerVisible(false)}
                onValueChange={(_, selectedDate) => {
                  setBirthDate(selectedDate);
                  setErrorMessage(null);
                  setHasSelectedDate(true);

                  if (Platform.OS !== 'ios') {
                    setIsPickerVisible(false);
                  }
                }}
                positiveButton={{ label: 'Use date' }}
                presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
                style={styles.picker}
                testID="birthday-picker"
                themeVariant="light"
                value={birthDate}
              />
            ) : (
              <Pressable
                accessibilityLabel="Choose birthday"
                accessibilityRole="button"
                onPress={() => setIsPickerVisible(true)}
                style={({ pressed }) => [
                  styles.pickerButton,
                  pressed && styles.pickerButtonPressed,
                ]}
              >
                <AppText style={styles.pickerButtonText} variant="button">
                  Pick a date
                </AppText>
              </Pressable>
            )}
          </View>

          {errorMessage === null ? null : (
            <View accessible accessibilityRole="alert" style={styles.errorMessage}>
              <AppText style={styles.errorText}>{errorMessage}</AppText>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <AppText style={styles.supportingText} variant="caption">
            Draft sync is on
          </AppText>
          <AppButton
            accessibilityLabel={isSaving ? 'Saving birthday' : 'Save birthday and continue'}
            disabled={!hasSelectedDate || isSaving}
            label={isSaving ? 'Committing…' : 'Commit & continue'}
            onPress={() => void save()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
