import {
  PROFILE_PROMPT_CATALOGUE,
  type DiscoveryProfile,
  type PullRequestTarget,
  type RelationshipIntent,
} from '@pro-date/contracts';
import { Image } from 'expo-image';
import Heart from 'lucide-react-native/icons/heart';
import { useReducedMotionPreference } from '../../theme/motion';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { PressableScale } from '../../components/pressable-scale';
import { cardShadow, colors, hairline, radii, spacing, typography } from '../../theme/tokens';

const intents: Record<RelationshipIntent, string> = {
  LONG_TERM: 'Long-term relationship',
  LONG_TERM_OPEN_TO_SHORT: 'Long-term, open to short',
  SHORT_TERM_OPEN_TO_LONG: 'Short-term, open to long',
  SHORT_TERM: 'Short-term relationship',
  FIGURING_IT_OUT: 'Figuring it out',
  FRIENDSHIP: 'Friendship',
};

export function TargetPreview({ target }: { target: PullRequestTarget }) {
  const [unavailable, setUnavailable] = useState(false);
  if (target.type === 'PHOTO')
    return unavailable ? (
      <View style={styles.removedPhoto}>
        <AppText variant="caption">The liked photo is no longer available.</AppText>
      </View>
    ) : (
      <Image
        accessibilityLabel="The photo they liked"
        contentFit="cover"
        contentPosition="center"
        source={{ uri: target.deliveryUrl }}
        style={styles.targetPhoto}
        onError={() => setUnavailable(true)}
      />
    );
  return (
    // A reminder of what they liked, not the full answer: it is the reader's own line.
    <View style={styles.targetPrompt}>
      <AppText style={styles.question} variant="caption" numberOfLines={2}>
        {PROFILE_PROMPT_CATALOGUE.find((prompt) => prompt.id === target.promptId)?.text}
      </AppText>
      <AppText style={styles.targetAnswer} numberOfLines={3}>
        {target.answer}
      </AppText>
    </View>
  );
}

export function DiscoveryProfileCard({
  profile,
  onLike,
}: {
  profile: DiscoveryProfile;
  onLike?: ((target: PullRequestTarget) => void) | undefined;
}) {
  const reducedMotion = useReducedMotionPreference();
  const { width } = useWindowDimensions();
  const details = [
    profile.genderIdentity,
    profile.pronouns,
    profile.heightCm === null ? null : `${profile.heightCm} cm`,
  ].filter((value): value is string => value !== null);
  const likeButton = (label: string, target: PullRequestTarget) =>
    onLike === undefined ? null : (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Send a like for this item, with an optional comment"
        onPress={() => onLike(target)}
        style={styles.likeButton}
        pressedStyle={styles.pressed}
      >
        <Heart size={24} color={colors.coral} strokeWidth={2} />
      </PressableScale>
    );
  return (
    <View style={styles.profile}>
      <View style={styles.title}>
        <AppText variant="display">
          {profile.displayName}, {profile.age}
        </AppText>
        <AppText variant="caption">{profile.locationLabel}</AppText>
      </View>
      {profile.photos.map((photo, index) => {
        const prompt = profile.prompts[index];
        return (
          <View key={photo.id} style={styles.section}>
            <View
              style={[styles.photo, { height: Math.max(240, (width - spacing.lg * 2) * 1.25) }]}
            >
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${profile.displayName}, photo ${index + 1}`}
                contentFit="cover"
                contentPosition="center"
                cachePolicy="memory-disk"
                source={{ uri: photo.deliveryUrl }}
                style={StyleSheet.absoluteFill}
                transition={reducedMotion ? 0 : 150}
                testID={`discovery-photo-${index}`}
              />
              {likeButton(`Like photo ${index + 1}`, {
                type: 'PHOTO',
                id: photo.id,
                deliveryUrl: photo.deliveryUrl,
              })}
            </View>
            {index === 0 ? (
              <View style={styles.details}>
                {details.map((detail) => (
                  <View key={detail} style={styles.pill}>
                    <AppText style={styles.detailText} variant="caption">
                      {detail}
                    </AppText>
                  </View>
                ))}
                <View style={styles.intent}>
                  <AppText variant="eyebrow">Looking for</AppText>
                  <AppText variant="headline">{intents[profile.relationshipIntent]}</AppText>
                </View>
              </View>
            ) : null}
            {prompt === undefined ? null : (
              <View style={styles.prompt}>
                <AppText style={styles.question} variant="caption">
                  {PROFILE_PROMPT_CATALOGUE.find((item) => item.id === prompt.promptId)?.text}
                </AppText>
                <AppText variant="quote">{prompt.answer}</AppText>
                {onLike === undefined ? null : (
                  <View style={styles.promptAction}>
                    {likeButton(`Like prompt ${index + 1}`, {
                      type: 'PROMPT',
                      id: prompt.id,
                      promptId: prompt.promptId,
                      answer: prompt.answer,
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { gap: spacing.md },
  title: { gap: 2 },
  section: { gap: spacing.md },
  photo: {
    width: '100%',
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.sand,
  },
  likeButton: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: colors.border,
    ...cardShadow,
  },
  pressed: { backgroundColor: colors.coralSoft },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.xs },
  pill: {
    borderRadius: radii.pill,
    backgroundColor: colors.sand,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  detailText: { color: colors.ink },
  intent: { width: '100%', gap: 2, paddingTop: spacing.sm },
  prompt: {
    backgroundColor: colors.surface,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: hairline,
    borderColor: colors.border,
  },
  question: { fontFamily: typography.family.medium },
  targetPrompt: {
    backgroundColor: colors.sand,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  targetAnswer: { fontFamily: typography.family.serif, fontSize: 17, lineHeight: 24 },
  promptAction: { height: 52, marginRight: -spacing.sm, marginBottom: -spacing.sm },
  targetPhoto: {
    width: '100%',
    height: 220,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    backgroundColor: colors.sand,
  },
  removedPhoto: {
    padding: spacing.lg,
    backgroundColor: colors.sand,
    borderCurve: 'continuous',
    borderRadius: radii.md,
  },
});
