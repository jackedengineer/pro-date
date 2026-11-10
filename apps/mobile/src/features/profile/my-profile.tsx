import type { DiscoveryProfile, ProfileReview } from '@pro-date/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { SegmentedControl } from '../../components/segmented-control';
import { colors, hairline, radii, spacing } from '../../theme/tokens';
import { SignOutButton } from '../account/account-actions';
import { DiscoveryProfileCard } from '../discovery/discovery-profile-card';
import { ErrorNotice, QuietButton } from '../discovery/discovery-shared';
import type { EditableStep } from '../onboarding/profile-onboarding-flow';
import { calculateAge, ProfilePreviewCard } from '../onboarding/profile-preview-card';

const views = [
  { value: 'preview', label: 'Preview' },
  { value: 'edit', label: 'Edit' },
] as const;
type ProfileView = (typeof views)[number]['value'];

/** The member's profile exactly as Discover shows it, or null while required parts are missing. */
export function asDiscoveryProfile(review: ProfileReview): DiscoveryProfile | null {
  const { profile } = review;
  if (
    profile.displayName === null ||
    profile.birthDate === null ||
    profile.locationLabel === null ||
    profile.relationshipIntent === null ||
    review.photos.length === 0
  )
    return null;
  return {
    // Only a list key here; a preview is never sent anywhere.
    userId: '00000000-0000-4000-8000-000000000000',
    displayName: profile.displayName,
    age: calculateAge(profile.birthDate),
    locationLabel: profile.locationLabel,
    genderIdentity: profile.isGenderVisible ? profile.genderIdentity : null,
    pronouns: profile.arePronounsVisible ? profile.pronouns : null,
    heightCm: profile.isHeightVisible ? profile.heightCm : null,
    relationshipIntent: profile.relationshipIntent,
    photos: review.photos,
    prompts: review.prompts,
  };
}

/**
 * The Profile tab. It opens on the member's own profile as other people see it; Edit turns the
 * same profile into a list of things to change, each opening on its own.
 */
export function MyProfile({
  loadProfileReview,
  onEdit,
  onFinishSetup,
  reloadKey = 0,
}: {
  loadProfileReview: () => Promise<ProfileReview>;
  onEdit: (step: EditableStep) => void;
  onFinishSetup: () => void;
  /** Change it to reload, for example after an edit sheet closes. */
  reloadKey?: number;
}) {
  const [review, setReview] = useState<ProfileReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ProfileView>('preview');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void loadProfileReview()
      .then((loaded) => {
        if (!active) return;
        setReview(loaded);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'Couldn’t load your profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadProfileReview, reloadKey, attempt]);

  const edit = useCallback((step: EditableStep) => () => onEdit(step), [onEdit]);
  const preview = review === null ? null : asDiscoveryProfile(review);
  const live =
    review !== null && review.publishedAt !== null && review.missingSections.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {review === null ? (
        loading ? (
          <View
            accessibilityLabel="Loading your profile"
            accessibilityRole="progressbar"
            style={styles.loading}
          >
            <ActivityIndicator color={colors.plum} />
          </View>
        ) : (
          <>
            <ErrorNotice message={error} />
            <QuietButton
              label="Retry loading profile"
              onPress={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            />
          </>
        )
      ) : (
        <>
          <ErrorNotice message={error} />
          {live ? null : (
            <View accessibilityRole="alert" style={styles.notice}>
              <AppText variant="headline">Your profile isn’t live yet</AppText>
              <AppText style={styles.muted}>
                {review.missingSections.length === 0
                  ? 'Publish it to appear in Discover.'
                  : `Finish your ${review.missingSections.map((section) => section.toLowerCase()).join(', ')} to appear in Discover.`}
              </AppText>
              <AppButton label="Finish profile" onPress={onFinishSetup} />
            </View>
          )}
          <SegmentedControl label="Profile view" options={views} value={view} onChange={setView} />
          {view === 'preview' ? (
            preview === null ? (
              <AppText style={styles.muted}>
                Your preview appears once your name, birthday, location and photos are in.
              </AppText>
            ) : (
              <>
                <AppText variant="caption">
                  {live
                    ? 'Live. This is how you appear in Discover.'
                    : 'How you’ll appear in Discover.'}
                </AppText>
                <DiscoveryProfileCard profile={preview} />
              </>
            )
          ) : (
            <>
              <AppText variant="caption">
                Tap anything to change it. Changes save straight to your profile.
              </AppText>
              <ProfilePreviewCard
                review={review}
                onEditBirthday={edit('birthday')}
                onEditHeight={edit('height')}
                onEditIdentity={edit('identity')}
                onEditLocation={edit('location')}
                onEditName={edit('name')}
                onEditPhotos={edit('photos')}
                onEditPreferences={edit('preferences')}
                onEditPrompts={edit('prompts')}
              />
            </>
          )}
        </>
      )}
      <View style={styles.account}>
        <SignOutButton />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  loading: { paddingVertical: spacing.xl },
  muted: { color: colors.muted },
  notice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: hairline,
    gap: spacing.sm,
    padding: spacing.md,
  },
  account: {
    borderTopColor: colors.border,
    borderTopWidth: hairline,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
});
