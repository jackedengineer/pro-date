import {
  PROFILE_PROMPT_CATALOGUE,
  type DiscoveryProfile,
  type PullRequestTarget,
  type RelationshipIntent,
} from '@pro-date/contracts';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';

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
    <View style={styles.prompt}>
      <AppText style={styles.question} variant="caption">
        {PROFILE_PROMPT_CATALOGUE.find((prompt) => prompt.id === target.promptId)?.text}
      </AppText>
      <AppText style={styles.answer}>{target.answer}</AppText>
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
  const { width } = useWindowDimensions();
  const details = [
    profile.genderIdentity,
    profile.pronouns,
    profile.heightCm === null ? null : `${profile.heightCm} cm`,
  ].filter((value): value is string => value !== null);
  const likeButton = (label: string, target: PullRequestTarget) =>
    onLike === undefined ? null : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Send a like for this item, with an optional comment"
        onPress={() => onLike(target)}
        style={({ pressed }) => [styles.likeButton, pressed && styles.pressed]}
      >
        <AppText style={styles.heart}>♡</AppText>
      </Pressable>
    );
  return (
    <View style={styles.profile}>
      <View style={styles.title}>
        <AppText variant="title">
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
                transition={150}
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
                  <AppText>{intents[profile.relationshipIntent]}</AppText>
                </View>
              </View>
            ) : null}
            {prompt === undefined ? null : (
              <View style={styles.prompt}>
                <AppText style={styles.question} variant="caption">
                  {PROFILE_PROMPT_CATALOGUE.find((item) => item.id === prompt.promptId)?.text}
                </AppText>
                <AppText style={styles.answer}>{prompt.answer}</AppText>
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
  profile: { gap: spacing.lg },
  title: { gap: spacing.xs },
  section: { gap: spacing.lg },
  photo: {
    width: '100%',
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.plumSoft,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  heart: { color: colors.plum, fontSize: 30, lineHeight: 36 },
  pressed: { backgroundColor: colors.plumSoft },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    borderRadius: radii.pill,
    backgroundColor: colors.plumSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailText: { color: colors.plum },
  intent: { width: '100%', gap: spacing.xs, paddingTop: spacing.sm },
  prompt: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  question: { color: colors.plum, fontFamily: typography.family.medium },
  answer: { fontSize: 22, lineHeight: 32, fontFamily: typography.family.medium },
  promptAction: { height: 52, marginRight: -spacing.md, marginBottom: -spacing.md },
  targetPhoto: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    backgroundColor: colors.plumSoft,
  },
  removedPhoto: { padding: spacing.lg, backgroundColor: colors.plumSoft, borderRadius: radii.md },
});
