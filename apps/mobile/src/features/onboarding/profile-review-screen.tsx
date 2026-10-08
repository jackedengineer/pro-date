import type { ProfileReview } from '@pro-date/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';
import { OnboardingStepLayout } from './onboarding-step-layout';
import { ProfilePreviewCard } from './profile-preview-card';

interface ProfileReviewScreenProps {
  onDiscover?: (() => void) | undefined;
  loadProfileReview: () => Promise<ProfileReview>;
  onEditBirthday: (profile: ProfileReview['profile']) => void;
  onEditHeight: (profile: ProfileReview['profile']) => void;
  onEditIdentity: (profile: ProfileReview['profile']) => void;
  onEditLocation: (profile: ProfileReview['profile']) => void;
  onEditName: (profile: ProfileReview['profile']) => void;
  onEditPhotos: (profile: ProfileReview['profile']) => void;
  onEditPreferences: (profile: ProfileReview['profile']) => void;
  onEditPrompts: (profile: ProfileReview['profile']) => void;
  publishProfile: () => Promise<ProfileReview>;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ProfileReviewScreen({
  onDiscover,
  loadProfileReview,
  onEditBirthday,
  onEditHeight,
  onEditIdentity,
  onEditLocation,
  onEditName,
  onEditPhotos,
  onEditPreferences,
  onEditPrompts,
  publishProfile,
}: ProfileReviewScreenProps) {
  const [review, setReview] = useState<ProfileReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isReviewingPublished, setIsReviewingPublished] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);

    try {
      setReview(await loadProfileReview());
    } catch (error: unknown) {
      setLoadError(errorMessage(error, 'We could not load your profile review.'));
    } finally {
      setIsLoading(false);
    }
  }, [loadProfileReview]);

  useEffect(() => {
    let isActive = true;

    void loadProfileReview()
      .then((loadedReview) => {
        if (isActive) setReview(loadedReview);
      })
      .catch((error: unknown) => {
        if (isActive) {
          setLoadError(errorMessage(error, 'We could not load your profile review.'));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadProfileReview]);

  const publish = async () => {
    if (review === null || review.missingSections.length > 0 || isPublishing) return;

    setPublishError(null);
    setIsPublishing(true);

    try {
      setReview(await publishProfile());
      setIsReviewingPublished(false);
      setIsPublishing(false);
    } catch (error: unknown) {
      setPublishError(errorMessage(error, 'We could not publish your profile.'));
      setIsPublishing(false);
    }
  };

  if (
    review?.publishedAt !== null &&
    review?.publishedAt !== undefined &&
    !isReviewingPublished &&
    review.missingSections.length === 0
  ) {
    return (
      <OnboardingStepLayout current={9} footer={null}>
        <View style={styles.publishedMark}>
          <AppText style={styles.publishedIcon} variant="title">
            ✓
          </AppText>
        </View>
        <AppText variant="eyebrow">Profile shipped</AppText>
        <AppText variant="display">Your profile is live.</AppText>
        <AppText style={styles.supportingText}>
          You’re ready to meet your kind of people. A good connection starts with something
          specific.
        </AppText>
        {onDiscover === undefined ? null : (
          <AppButton label="Explore profiles" onPress={onDiscover} />
        )}
        <AppButton label="Review my profile" onPress={() => setIsReviewingPublished(true)} />
      </OnboardingStepLayout>
    );
  }

  return (
    <OnboardingStepLayout
      current={9}
      footer={
        review === null || loadError !== null ? null : (
          <View style={styles.footer}>
            {publishError === null ? null : (
              <View accessibilityRole="alert" accessible style={styles.errorCard}>
                <AppText style={styles.errorText}>{publishError}</AppText>
              </View>
            )}
            <AppText style={styles.privacyNote} variant="caption">
              Only the profile details you chose to show are visible to other members. Your birthday
              and exact location stay private.
            </AppText>
            <AppButton
              accessibilityLabel={isPublishing ? 'Publishing profile' : 'Publish profile'}
              disabled={review.missingSections.length > 0 || isPublishing}
              label={isPublishing ? 'Publishing…' : 'Publish profile'}
              onPress={() => void publish()}
            />
          </View>
        )
      }
    >
      <AppText variant="eyebrow">Final review</AppText>
      <AppText variant="display">{"Preview the profile you're shipping."}</AppText>
      <AppText style={styles.supportingText}>
        This is your discovery card. Check the visible details, photo order, and every conversation
        hook before publishing.
      </AppText>

      {isLoading ? (
        <View accessibilityRole="progressbar" style={styles.loadingCard}>
          <ActivityIndicator color={colors.plum} />
          <AppText style={styles.supportingText}>Building your preview…</AppText>
        </View>
      ) : loadError !== null ? (
        <View accessibilityRole="alert" accessible style={styles.errorCard}>
          <AppText style={styles.errorTitle} variant="title">
            Preview unavailable
          </AppText>
          <AppText style={styles.errorText}>{loadError}</AppText>
          <AppButton label="Retry profile review" onPress={() => void refresh()} />
        </View>
      ) : review === null ? null : (
        <>
          {review.missingSections.length === 0 ? null : (
            <View accessibilityRole="alert" accessible style={styles.errorCard}>
              <AppText style={styles.errorTitle} variant="title">
                A few commits are missing
              </AppText>
              <AppText style={styles.errorText}>
                Finish {review.missingSections.map((section) => section.toLowerCase()).join(', ')}
                before publishing.
              </AppText>
            </View>
          )}
          <ProfilePreviewCard
            onEditBirthday={() => onEditBirthday(review.profile)}
            onEditHeight={() => onEditHeight(review.profile)}
            onEditIdentity={() => onEditIdentity(review.profile)}
            onEditLocation={() => onEditLocation(review.profile)}
            onEditName={() => onEditName(review.profile)}
            onEditPhotos={() => onEditPhotos(review.profile)}
            onEditPreferences={() => onEditPreferences(review.profile)}
            onEditPrompts={() => onEditPrompts(review.profile)}
            review={review}
          />
        </>
      )}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
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
  },
  footer: {
    gap: spacing.md,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  privacyNote: {
    textAlign: 'center',
  },
  publishedIcon: {
    color: colors.white,
  },
  publishedMark: {
    alignItems: 'center',
    backgroundColor: colors.plum,
    borderRadius: radii.pill,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 56,
  },
  supportingText: {
    color: colors.muted,
  },
});
