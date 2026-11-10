import {
  PROFILE_PROMPT_CATALOGUE,
  type ProfileReview,
  type RelationshipIntent,
} from '@pro-date/contracts';
import { Image } from 'expo-image';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Pencil from 'lucide-react-native/icons/pencil';
import { useState } from 'react';
import { useReducedMotionPreference } from '../../theme/motion';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, hairline, radii, spacing, typography } from '../../theme/tokens';

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

export function calculateAge(birthDate: string): number {
  const today = new Date();
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - (year ?? today.getFullYear());
  const birthdayHasPassed =
    today.getMonth() + 1 > (month ?? 1) ||
    (today.getMonth() + 1 === (month ?? 1) && today.getDate() >= (day ?? 1));

  if (!birthdayHasPassed) age -= 1;

  return age;
}

/** One editable fact: what it is, what it says now, and a tap to change it. */
function EditRow({
  label,
  value,
  note,
  editLabel,
  onPress,
  last = false,
}: {
  label: string;
  value: string;
  note?: string | undefined;
  editLabel: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`Edit ${editLabel}`}
      accessibilityHint={`${label}: ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="headline">{value}</AppText>
        {note === undefined ? null : (
          <AppText style={styles.rowNote} variant="caption">
            {note}
          </AppText>
        )}
      </View>
      <ChevronRight color={colors.muted} size={20} strokeWidth={1.8} />
    </Pressable>
  );
}

function EditBadge() {
  return (
    <View style={styles.editBadge}>
      <Pencil size={14} color={colors.plum} />
      <AppText style={styles.editBadgeText} variant="caption">
        Edit
      </AppText>
    </View>
  );
}

/**
 * The member's profile as a set of things they can change. Every part is its own target: tap
 * the photos, a detail or the answers to edit that part.
 */
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
  const reducedMotion = useReducedMotionPreference();
  const { width: viewportWidth } = useWindowDimensions();
  const [galleryWidth, setGalleryWidth] = useState<number | null>(null);
  const availableWidth = galleryWidth ?? viewportWidth - spacing.lg * 2;
  const thumbnailWidth = Math.max(0, (availableWidth - spacing.sm) / 2);
  const { profile } = review;
  const leadPhoto = review.photos[0];
  const identity = [profile.genderIdentity, profile.pronouns].filter(
    (detail): detail is string => detail !== null,
  );
  const hiddenIdentity = [
    profile.genderIdentity !== null && !profile.isGenderVisible ? 'gender' : null,
    profile.pronouns !== null && !profile.arePronounsVisible ? 'pronouns' : null,
  ].filter((detail): detail is string => detail !== null);

  const visibleDetails = [
    profile.isGenderVisible ? profile.genderIdentity : null,
    profile.arePronounsVisible ? profile.pronouns : null,
    profile.isHeightVisible && profile.heightCm !== null ? `${profile.heightCm} cm` : null,
  ].filter((detail): detail is string => detail !== null);

  return (
    <View style={styles.card}>
      {/* What other people see first: the name, the age, and only the details left visible. */}
      <View style={styles.summary}>
        <AppText variant="display">
          {profile.displayName ?? 'You'},{' '}
          {profile.birthDate === null ? '—' : calculateAge(profile.birthDate)}
        </AppText>
        <View style={styles.detailRow} testID="review-visible-details">
          {visibleDetails.map((detail) => (
            <View key={detail} style={styles.detailPill}>
              <AppText style={styles.detailText} variant="caption">
                {detail}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="headline">Your photos</AppText>
        <AppText variant="caption">{review.photos.length} of 6</AppText>
      </View>
      <Pressable
        accessibilityLabel="Edit photos"
        accessibilityRole="button"
        onPress={onEditPhotos}
        style={({ pressed }) => [styles.photos, pressed && styles.dimmed]}
      >
        {leadPhoto === undefined ? (
          <View style={[styles.leadPhotoFrame, styles.emptyPhoto]}>
            <AppText style={styles.muted}>Add your photos</AppText>
          </View>
        ) : (
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
              transition={reducedMotion ? 0 : 180}
            />
            <EditBadge />
          </View>
        )}
        <View
          onLayout={(event) => setGalleryWidth(event.nativeEvent.layout.width)}
          style={styles.photoStrip}
          testID="review-photo-gallery"
        >
          {review.photos.slice(1).map((photo, index) => (
            <View
              key={photo.id}
              style={[styles.thumbnail, { width: thumbnailWidth, height: thumbnailWidth * 1.25 }]}
              testID={`review-photo-frame-${index + 1}`}
            >
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`Profile photo ${index + 2} preview`}
                cachePolicy="memory-disk"
                contentFit="cover"
                contentPosition="center"
                source={{ uri: photo.deliveryUrl }}
                style={StyleSheet.absoluteFill}
                transition={reducedMotion ? 0 : 180}
              />
            </View>
          ))}
        </View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <AppText variant="headline">About you</AppText>
      </View>
      <View style={styles.rows}>
        <EditRow
          label="Name"
          value={profile.displayName ?? 'Add your name'}
          editLabel="name"
          onPress={onEditName}
        />
        <EditRow
          label="Age"
          value={
            profile.birthDate === null
              ? 'Add your birthday'
              : calculateAge(profile.birthDate).toString()
          }
          note="Your birthday itself stays private."
          editLabel="birthday"
          onPress={onEditBirthday}
        />
        <EditRow
          label="Location"
          value={profile.locationLabel ?? 'Add your location'}
          note="Your exact location stays private."
          editLabel="location"
          onPress={onEditLocation}
        />
        <EditRow
          label="Gender and pronouns"
          value={identity.length === 0 ? 'Add how you identify' : identity.join(' · ')}
          note={
            hiddenIdentity.length === 0
              ? undefined
              : `Your ${hiddenIdentity.join(' and ')} ${hiddenIdentity.length === 1 ? 'is' : 'are'} hidden on your profile.`
          }
          editLabel="identity"
          onPress={onEditIdentity}
        />
        <EditRow
          label="Height"
          value={profile.heightCm === null ? 'Add your height' : `${profile.heightCm} cm`}
          note={
            profile.heightCm !== null && !profile.isHeightVisible
              ? 'Hidden on your profile.'
              : undefined
          }
          editLabel="height"
          onPress={onEditHeight}
        />
        <EditRow
          label="Looking for"
          value={
            profile.relationshipIntent === null
              ? 'Add what you’re looking for'
              : intentLabels[profile.relationshipIntent]
          }
          editLabel="preferences"
          onPress={onEditPreferences}
          last
        />
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="headline">Conversation starters</AppText>
        <View style={styles.editHint}>
          <Pencil size={14} color={colors.plum} />
          <AppText style={styles.editBadgeText} variant="caption">
            Edit
          </AppText>
        </View>
      </View>
      <Pressable
        accessibilityLabel="Edit prompts"
        accessibilityRole="button"
        onPress={onEditPrompts}
        style={({ pressed }) => [styles.prompts, pressed && styles.dimmed]}
      >
        {review.prompts.length === 0 ? (
          <View style={styles.promptCard}>
            <AppText style={styles.muted}>Add three answers people can reply to</AppText>
          </View>
        ) : (
          review.prompts.map((answer) => {
            const prompt = PROFILE_PROMPT_CATALOGUE.find((item) => item.id === answer.promptId);

            return (
              <View key={answer.id} style={styles.promptCard}>
                <AppText style={styles.promptQuestion} variant="caption">
                  {prompt?.text}
                </AppText>
                <AppText style={styles.promptAnswer}>{answer.answer}</AppText>
              </View>
            );
          })
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  detailPill: {
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detailText: { color: colors.ink },
  summary: { gap: spacing.sm },
  dimmed: { opacity: 0.85 },
  editBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
  },
  editBadgeText: { color: colors.plum, fontFamily: typography.family.medium },
  editHint: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  emptyPhoto: { alignItems: 'center', justifyContent: 'center' },
  leadPhotoFrame: {
    aspectRatio: 0.8,
    backgroundColor: colors.sand,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    overflow: 'hidden',
    width: '100%',
  },
  muted: { color: colors.muted },
  photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photos: { gap: spacing.sm },
  pressed: { backgroundColor: colors.sand },
  promptAnswer: {
    fontFamily: typography.family.serif,
    fontSize: typography.size.quote,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: hairline,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  promptQuestion: { fontFamily: typography.family.medium },
  prompts: { gap: spacing.sm },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  rowDivider: { borderBottomColor: colors.border, borderBottomWidth: hairline },
  rowNote: { marginTop: 2 },
  rowText: { flex: 1, gap: 2 },
  rows: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  thumbnail: {
    backgroundColor: colors.sand,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
});
