import {
  PROFILE_PHOTO_MAX_COUNT,
  PROFILE_PHOTO_MIN_COUNT,
  type ProfilePhoto,
} from '@pro-date/contracts';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import type { LocalProfilePhoto } from '../../api/profile-photos';
import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { OnboardingStepLayout } from './onboarding-step-layout';
import { ProfileStepFooter } from './profile-step-footer';

interface ProfilePhotosScreenProps {
  completePhotos: (photoIds: string[]) => Promise<void>;
  loadPhotos: () => Promise<ProfilePhoto[]>;
  onBack?: (() => void) | undefined;
  pickPhoto: () => Promise<LocalProfilePhoto | null>;
  removePhoto: (photoId: string) => Promise<ProfilePhoto[]>;
  uploadPhoto: (photo: LocalProfilePhoto, position: number) => Promise<ProfilePhoto[]>;
}

function sortPhotos(photos: ProfilePhoto[]): ProfilePhoto[] {
  return [...photos].sort((left, right) => left.position - right.position);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ProfilePhotosScreen({
  completePhotos,
  loadPhotos,
  onBack,
  pickPhoto,
  removePhoto,
  uploadPhoto,
}: ProfilePhotosScreenProps) {
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePosition, setActivePosition] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);

    try {
      setPhotos(sortPhotos(await loadPhotos()));
    } catch (error: unknown) {
      setLoadError(errorMessage(error, 'We could not load your photo draft.'));
    } finally {
      setIsLoading(false);
    }
  }, [loadPhotos]);

  useEffect(() => {
    let isActive = true;

    void loadPhotos()
      .then((draftPhotos) => {
        if (isActive) setPhotos(sortPhotos(draftPhotos));
      })
      .catch((error: unknown) => {
        if (isActive) {
          setLoadError(errorMessage(error, 'We could not load your photo draft.'));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadPhotos]);

  const addPhoto = async (position: number) => {
    if (activePosition !== null || isSaving) return;

    setActionError(null);
    setActivePosition(position);

    try {
      const selectedPhoto = await pickPhoto();

      if (selectedPhoto !== null) {
        setPhotos(sortPhotos(await uploadPhoto(selectedPhoto, position)));
      }
    } catch (error: unknown) {
      setActionError(errorMessage(error, 'We could not add that photo.'));
    } finally {
      setActivePosition(null);
    }
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    const destination = index + direction;

    if (destination < 0 || destination >= photos.length || activePosition !== null || isSaving) {
      return;
    }

    setPhotos((current) => {
      const next = [...current];
      const currentPhoto = next[index];
      const destinationPhoto = next[destination];

      if (currentPhoto === undefined || destinationPhoto === undefined) return current;
      next[index] = destinationPhoto;
      next[destination] = currentPhoto;

      return next;
    });
  };

  const confirmRemove = (photo: ProfilePhoto, position: number) => {
    if (activePosition !== null || isSaving) return;

    Alert.alert(
      'Remove this photo?',
      'It will be deleted from your ProDate profile and media storage.',
      [
        { style: 'cancel', text: 'Keep photo' },
        {
          onPress: () => {
            setActionError(null);
            setActivePosition(position);
            void removePhoto(photo.id)
              .then((remaining) => setPhotos(sortPhotos(remaining)))
              .catch((error: unknown) =>
                setActionError(errorMessage(error, 'We could not remove that photo.')),
              )
              .finally(() => setActivePosition(null));
          },
          style: 'destructive',
          text: 'Remove',
        },
      ],
    );
  };

  const complete = async () => {
    if (photos.length < PROFILE_PHOTO_MIN_COUNT || activePosition !== null || isSaving) return;

    setActionError(null);
    setIsSaving(true);

    try {
      await completePhotos(photos.map((photo) => photo.id));
    } catch (error: unknown) {
      setActionError(errorMessage(error, 'We could not commit your photos.'));
      setIsSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      current={7}
      footer={
        loadError === null ? (
          <ProfileStepFooter
            accessibilityLabel="Commit photos and continue"
            disabled={photos.length < PROFILE_PHOTO_MIN_COUNT || activePosition !== null}
            errorMessage={actionError}
            isSaving={isSaving}
            onPress={() => void complete()}
          />
        ) : null
      }
      onBack={activePosition === null && !isSaving ? onBack : undefined}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <AppText variant="eyebrow">Visual commit</AppText>
          <AppText variant="display">Show the build, not just the bio.</AppText>
        </View>
        <View style={styles.countPill}>
          <AppText style={styles.countText} variant="caption">
            {photos.length} / {PROFILE_PHOTO_MAX_COUNT} committed
          </AppText>
        </View>
      </View>
      <AppText style={styles.supportingText}>
        Add at least four clear photos. Give the grid range—face, full frame, and a life beyond the
        laptop.
      </AppText>

      {isLoading ? (
        <View accessibilityRole="progressbar" style={styles.loadingCard}>
          <ActivityIndicator color={colors.plum} />
          <AppText style={styles.supportingText}>Fetching your photo draft…</AppText>
        </View>
      ) : loadError === null ? (
        <View style={styles.grid}>
          {Array.from({ length: PROFILE_PHOTO_MAX_COUNT }, (_, index) => {
            const currentPhoto = photos[index];

            if (currentPhoto === undefined) {
              const isUploading = activePosition === index;

              return (
                <Pressable
                  accessibilityLabel={`Add photo ${index + 1}`}
                  accessibilityRole="button"
                  disabled={activePosition !== null || isSaving}
                  key={`empty-${index}`}
                  onPress={() => void addPhoto(index)}
                  style={({ pressed }) => [
                    styles.photoCard,
                    styles.emptyCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {isUploading ? (
                    <ActivityIndicator color={colors.plum} />
                  ) : (
                    <>
                      <View style={styles.addIcon}>
                        <AppText style={styles.addIconText}>+</AppText>
                      </View>
                      <AppText style={styles.addLabel} variant="caption">
                        {index === 0 ? 'Add lead photo' : `Add photo ${index + 1}`}
                      </AppText>
                    </>
                  )}
                </Pressable>
              );
            }

            return (
              <View
                accessibilityLabel={
                  index === 0 ? 'Lead profile photo' : `Profile photo ${index + 1}`
                }
                accessible
                key={currentPhoto.id}
                style={styles.photoCard}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  cachePolicy="disk"
                  contentFit="cover"
                  source={{ uri: currentPhoto.deliveryUrl }}
                  style={StyleSheet.absoluteFill}
                  transition={180}
                />
                <View style={styles.photoShade} />
                <View style={styles.photoHeader}>
                  <View style={styles.positionBadge}>
                    <AppText style={styles.positionText} variant="caption">
                      {index === 0 ? 'LEAD' : `0${index + 1}`}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    accessibilityRole="button"
                    disabled={activePosition !== null || isSaving}
                    hitSlop={4}
                    onPress={() => confirmRemove(currentPhoto, index)}
                    style={styles.removeButton}
                  >
                    {activePosition === index ? (
                      <ActivityIndicator color={colors.ink} size="small" />
                    ) : (
                      <AppText style={styles.removeText}>×</AppText>
                    )}
                  </Pressable>
                </View>
                <View style={styles.reorderRow}>
                  <Pressable
                    accessibilityLabel={`Move photo ${index + 1} earlier`}
                    accessibilityRole="button"
                    disabled={index === 0 || activePosition !== null || isSaving}
                    hitSlop={4}
                    onPress={() => movePhoto(index, -1)}
                    style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                  >
                    <AppText style={styles.reorderText}>←</AppText>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Move photo ${index + 1} later`}
                    accessibilityRole="button"
                    disabled={index === photos.length - 1 || activePosition !== null || isSaving}
                    hitSlop={4}
                    onPress={() => movePhoto(index, 1)}
                    style={[
                      styles.reorderButton,
                      index === photos.length - 1 && styles.reorderButtonDisabled,
                    ]}
                  >
                    <AppText style={styles.reorderText}>→</AppText>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View accessibilityRole="alert" accessible style={styles.errorCard}>
          <AppText style={styles.errorTitle} variant="title">
            Upload lane unavailable
          </AppText>
          <AppText style={styles.errorText}>{loadError}</AppText>
          <AppButton label="Retry loading photos" onPress={() => void refresh()} />
        </View>
      )}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  addIcon: {
    alignItems: 'center',
    backgroundColor: colors.plumSoft,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  addIconText: {
    color: colors.plum,
    fontFamily: typography.family.medium,
    fontSize: 26,
    lineHeight: 29,
  },
  addLabel: {
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
  cardPressed: {
    backgroundColor: colors.plumSoft,
    transform: [{ scale: 0.98 }],
  },
  countPill: {
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countText: {
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    gap: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 21,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  headingCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
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
  photoCard: {
    aspectRatio: 0.78,
    borderRadius: radii.md,
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '48%',
    overflow: 'hidden',
  },
  photoHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  photoShade: {
    backgroundColor: 'rgba(33, 26, 31, 0.14)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  positionBadge: {
    backgroundColor: 'rgba(33, 26, 31, 0.72)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  positionText: {
    color: colors.white,
    fontFamily: typography.family.medium,
    fontSize: 10,
  },
  reorderButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  reorderButtonDisabled: {
    opacity: 0.38,
  },
  reorderRow: {
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    position: 'absolute',
    right: spacing.sm,
  },
  reorderText: {
    color: colors.ink,
    fontFamily: typography.family.medium,
    fontSize: 18,
    lineHeight: 21,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  removeText: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 27,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 360,
  },
});
