import {
  PROFILE_PROMPT_CATALOGUE,
  type ProfileReview,
  type RelationshipIntent,
} from '@pro-date/contracts';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface ProfilePreviewCardProps {
  onEditBirthday: () => void;
  onEditIdentity: () => void;
  onEditHeight: () => void;
  onEditLocation: () => void;
  onEditName: () => void;
  onEditPhotos: () => void;
  onEditPreferences: () => void;
  onEditPrompts: () => void;
  review: ProfileReview;
}

const intentLabels: Record<RelationshipIntent, string> = {
  FIGURING_IT_OUT: 'Figuring it out',
  FRIENDSHIP: 'Friendship',
  LONG_TERM: 'Long-term relationship',
  LONG_TERM_OPEN_TO_SHORT: 'Long-term, open to short',
  SHORT_TERM: 'Short-term relationship',
  SHORT_TERM_OPEN_TO_LONG: 'Short-term, open to long',
};

function calculateAge(birthDate: string): number {
  const today = new Date();
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - (year ?? today.getFullYear());
  const birthdayHasPassed =
    today.getMonth() + 1 > (month ?? 1) ||
    (today.getMonth() + 1 === (month ?? 1) && today.getDate() >= (day ?? 1));

  if (!birthdayHasPassed) age -= 1;

  return age;
}

function EditButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Edit ${label.toLowerCase()}`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
    >
      <AppText style={styles.editText} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

export function ProfilePreviewCard({
  onEditBirthday,
  onEditIdentity,
  onEditHeight,
  onEditLocation,
  onEditName,
  onEditPhotos,
  onEditPreferences,
  onEditPrompts,
  review,
}: ProfilePreviewCardProps) {
  const { profile } = review;
  const leadPhoto = review.photos[0];
  const visibleDetails = [
    profile.isGenderVisible ? profile.genderIdentity : null,
    profile.arePronounsVisible ? profile.pronouns : null,
    profile.isHeightVisible && profile.heightCm !== null ? `${profile.heightCm} cm` : null,
  ].filter((detail): detail is string => detail !== null);

  return (
    <View style={styles.card}>
      {leadPhoto === undefined ? null : (
        <View style={styles.leadPhotoFrame}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Lead profile photo preview"
            cachePolicy="memory-disk"
            contentFit="cover"
            contentPosition="center"
            source={{ uri: leadPhoto.deliveryUrl }}
            style={StyleSheet.absoluteFill}
            testID="review-lead-photo"
            transition={180}
          />
          <View style={styles.photoScrim} />
          <View style={styles.photoTitle}>
            <AppText style={styles.name} variant="title">
              {profile.displayName},{' '}
              {profile.birthDate === null ? '—' : calculateAge(profile.birthDate)}
            </AppText>
            {profile.locationLabel === null ? null : (
              <AppText style={styles.location}>{profile.locationLabel}</AppText>
            )}
          </View>
        </View>
      )}

      <View style={styles.editRow}>
        <EditButton label="Name" onPress={onEditName} />
        <EditButton label="Birthday" onPress={onEditBirthday} />
        <EditButton label="Identity" onPress={onEditIdentity} />
        <EditButton label="Height" onPress={onEditHeight} />
        <EditButton label="Preferences" onPress={onEditPreferences} />
        <EditButton label="Location" onPress={onEditLocation} />
        <EditButton label="Photos" onPress={onEditPhotos} />
        <EditButton label="Prompts" onPress={onEditPrompts} />
      </View>

      {visibleDetails.length === 0 ? null : (
        <View style={styles.detailRow}>
          {visibleDetails.map((detail) => (
            <View key={detail} style={styles.detailPill}>
              <AppText style={styles.detailText} variant="caption">
                {detail}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {profile.relationshipIntent === null ? null : (
        <View style={styles.intentCard}>
          <AppText variant="eyebrow">Looking for</AppText>
          <AppText>{intentLabels[profile.relationshipIntent]}</AppText>
        </View>
      )}

      {review.prompts.map((answer) => {
        const prompt = PROFILE_PROMPT_CATALOGUE.find((item) => item.id === answer.promptId);

        return (
          <View key={answer.id} style={styles.promptCard}>
            <AppText style={styles.promptQuestion} variant="caption">
              {prompt?.text}
            </AppText>
            <AppText style={styles.promptAnswer}>{answer.answer}</AppText>
          </View>
        );
      })}

      <View style={styles.photoStrip}>
        {review.photos.slice(1).map((photo, index) => (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`Profile photo ${index + 2} preview`}
            cachePolicy="memory-disk"
            contentFit="cover"
            contentPosition="center"
            key={photo.id}
            source={{ uri: photo.deliveryUrl }}
            style={styles.thumbnail}
            transition={180}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    overflow: 'hidden',
    paddingBottom: spacing.lg,
  },
  detailPill: {
    backgroundColor: colors.plumSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  detailText: {
    color: colors.plum,
  },
  editButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  editButtonPressed: {
    backgroundColor: colors.plumSoft,
  },
  editRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  editText: {
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
  intentCard: {
    backgroundColor: colors.sand,
    borderRadius: radii.md,
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    padding: spacing.md,
  },
  leadPhotoFrame: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.plumSoft,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  location: {
    color: colors.white,
  },
  name: {
    color: colors.white,
  },
  photoScrim: {
    bottom: 0,
    backgroundColor: 'rgba(18, 10, 16, 0.22)',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  photoStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  photoTitle: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  promptAnswer: {
    fontFamily: typography.family.medium,
    fontSize: 19,
    lineHeight: 28,
  },
  promptCard: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
  },
  promptQuestion: {
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
  thumbnail: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.plumSoft,
    borderRadius: radii.sm,
    flex: 1,
  },
});
