import {
  PROFILE_PHOTO_MAX_COUNT,
  PROFILE_PHOTO_MIN_COUNT,
  type ProfilePhoto,
} from '@pro-date/contracts';
import { Image } from 'expo-image';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import { useReducedMotionPreference } from '../../theme/motion';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

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

const PHOTO_CARD_ASPECT_RATIO = 4 / 5;

function getPhotoCardSize(gridWidth: number) {
  const width = Math.max(0, (gridWidth - spacing.md) / 2);

  return {
    height: width / PHOTO_CARD_ASPECT_RATIO,
    width,
  };
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
  const reducedMotion = useReducedMotionPreference();
  const { width: viewportWidth } = useWindowDimensions();
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePosition, setActivePosition] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [measuredGridWidth, setMeasuredGridWidth] = useState<number | null>(null);
  const photosByPosition = new Map(photos.map((photo) => [photo.position, photo]));
  const gridWidth = measuredGridWidth ?? Math.max(0, viewportWidth - spacing.lg * 2);
  const photoCardSize = getPhotoCardSize(gridWidth);

  const measureGrid = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;

    setMeasuredGridWidth((currentWidth) =>
      currentWidth === null || Math.abs(currentWidth - nextWidth) >= 0.5 ? nextWidth : currentWidth,
    );
  }, []);

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

      return next.map((photo, position) => ({ ...photo, position }));
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
          <AppText variant="eyebrow">Your photos</AppText>
          <AppText variant="display">A little more you.</AppText>
        </View>
        <View style={styles.countPill}>
          <AppText style={styles.countText} variant="caption">
            {photos.length} / {PROFILE_PHOTO_MAX_COUNT} added
          </AppText>
        </View>
      </View>
      <AppText style={styles.supportingText}>
        Add four to six photos. A clear face, your favourite places, and life beyond the laptop.
      </AppText>

      {isLoading ? (
        <View accessibilityRole="progressbar" style={styles.loadingCard}>
          <ActivityIndicator color={colors.plum} />
          <AppText style={styles.supportingText}>Fetching your photo draft…</AppText>
        </View>
      ) : loadError === null ? (
        <View onLayout={measureGrid} style={styles.grid} testID="profile-photo-grid">
          {Array.from({ length: PROFILE_PHOTO_MAX_COUNT }, (_, index) => {
            const currentPhoto = photosByPosition.get(index);

            if (currentPhoto === undefined) {
              const isUploading = activePosition === index;

              return (
                <Pressable
                  accessibilityLabel={`Add photo ${index + 1}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    busy: isUploading,
                    disabled: activePosition !== null || isSaving,
                  }}
                  disabled={activePosition !== null || isSaving}
                  key={`empty-${index}`}
                  onPress={() => void addPhoto(index)}
                  style={({ pressed }) => [
                    styles.photoCard,
                    photoCardSize,
                    styles.emptyCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={styles.emptyContent}
                    testID={`empty-photo-content-${index}`}
                  >
                    {isUploading ? (
                      <>
                        <ActivityIndicator color={colors.plum} />
                        <AppText style={styles.addLabel} variant="caption">
                          Uploading…
                        </AppText>
                      </>
                    ) : (
                      <>
                        <View style={styles.addIcon}>
                          <Plus size={24} color={colors.plum} />
                        </View>
                        <AppText style={styles.addLabel} variant="caption">
                          {index === 0 ? 'Add lead photo' : `Add photo ${index + 1}`}
                        </AppText>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            }

            const photoOrderIndex = photos.findIndex((photo) => photo.id === currentPhoto.id);

            return (
              <View
                key={currentPhoto.id}
                testID={`profile-photo-slot-${index}`}
                style={[styles.photoCard, photoCardSize]}
              >
                <Image
                  accessible
                  accessibilityLabel={
                    index === 0 ? 'Lead profile photo' : `Profile photo ${index + 1}`
                  }
                  accessibilityIgnoresInvertColors
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  contentPosition="center"
                  source={{ uri: currentPhoto.deliveryUrl }}
                  style={StyleSheet.absoluteFill}
                  testID={`profile-photo-image-${index}`}
                  transition={reducedMotion ? 0 : 180}
                />
                <View pointerEvents="none" style={styles.imageOutline} />
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
                    onPress={() => confirmRemove(currentPhoto, index)}
                    style={styles.removeButton}
                  >
                    {activePosition === index ? (
                      <ActivityIndicator color={colors.ink} size="small" />
                    ) : (
                      <X size={20} color={colors.ink} />
                    )}
                  </Pressable>
                </View>
                <View style={styles.reorderRow}>
                  <Pressable
                    accessibilityLabel={`Move photo ${index + 1} earlier`}
                    accessibilityRole="button"
                    disabled={photoOrderIndex === 0 || activePosition !== null || isSaving}
                    onPress={() => movePhoto(photoOrderIndex, -1)}
                    style={[
                      styles.reorderButton,
                      photoOrderIndex === 0 && styles.reorderButtonDisabled,
                    ]}
                  >
                    <ArrowLeft size={18} color={colors.ink} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Move photo ${index + 1} later`}
                    accessibilityRole="button"
                    disabled={
                      photoOrderIndex === photos.length - 1 || activePosition !== null || isSaving
                    }
                    onPress={() => movePhoto(photoOrderIndex, 1)}
                    style={[
                      styles.reorderButton,
                      photoOrderIndex === photos.length - 1 && styles.reorderButtonDisabled,
                    ]}
                  >
                    <ArrowRight size={18} color={colors.ink} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View accessibilityRole="alert" accessible style={styles.errorCard}>
          <AppText style={styles.errorTitle} variant="title">
            Photos unavailable
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
  addLabel: {
    color: colors.plum,
    fontFamily: typography.family.medium,
    textAlign: 'center',
  },
  cardPressed: {
    backgroundColor: colors.plumSoft,
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
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  emptyContent: {
    alignItems: 'center',
    bottom: 0,
    gap: spacing.sm,
    justifyContent: 'center',
    left: 0,
    padding: spacing.md,
    position: 'absolute',
    right: 0,
    top: 0,
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
  photoCard: {
    backgroundColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  imageOutline: {
    bottom: 0,
    borderColor: 'rgba(33, 26, 31, 0.12)',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  photoHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
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
    fontSize: 12,
  },
  reorderButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
  removeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 360,
  },
});
