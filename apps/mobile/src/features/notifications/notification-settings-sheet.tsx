import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Switch, View } from 'react-native';
import type { NotificationsApi } from '../../api/notifications';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';
import { ErrorNotice, QuietButton } from '../discovery/discovery-shared';
import { DiscoverySheet } from '../discovery/discovery-sheet';
import type { MessagingRuntime } from '../messaging/messaging-provider';

export function NotificationSettingsButton({
  runtime,
  conversationId,
}: {
  runtime: MessagingRuntime;
  conversationId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <QuietButton
        label={conversationId === undefined ? 'Notifications' : 'Chat notifications'}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
      />
      {open ? (
        <NotificationSettingsSheet
          key={`${runtime.ownerId}:${conversationId ?? 'all'}`}
          ownerId={runtime.ownerId}
          api={runtime.notifications}
          conversationId={conversationId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function NotificationSettingsSheet({
  ownerId,
  api,
  conversationId,
  onClose,
}: {
  ownerId: string;
  api: NotificationsApi;
  conversationId?: string | undefined;
  onClose: () => void;
}) {
  const queries = useQueryClient();
  const settingsKey = ['notification-settings', ownerId];
  const preferenceKey = ['conversation-notification', ownerId, conversationId];
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) => api.settings(signal),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const preference = useQuery({
    queryKey: preferenceKey,
    queryFn: ({ signal }) => api.conversation(conversationId!, signal),
    enabled: conversationId !== undefined && settings.data?.isAvailable === true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const alive = useRef(true);
  const writing = useRef(false);
  const operations = useRef(new Set<AbortController>());
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    const pending = operations.current;
    return () => {
      alive.current = false;
      for (const operation of pending) operation.abort();
      pending.clear();
    };
  }, []);
  const mutation = useMutation({
    // Keep server state in owner-keyed queries, not a retained history of setting attempts.
    gcTime: 0,
    networkMode: 'always',
    retry: false,
    mutationFn: async ({ kind, value }: { kind: 'PAUSE' | 'CHAT'; value: boolean }) => {
      if (!onlineManager.isOnline()) throw new Error('Go online to save notification preferences.');
      const controller = new AbortController();
      operations.current.add(controller);
      try {
        return kind === 'PAUSE'
          ? ({ kind, data: await api.saveSettings(value, controller.signal) } as const)
          : ({
              kind,
              data: await api.saveConversation(conversationId!, value, controller.signal),
            } as const);
      } finally {
        operations.current.delete(controller);
      }
    },
    onSuccess: (result) => {
      if (!alive.current) return;
      queries.setQueryData(result.kind === 'PAUSE' ? settingsKey : preferenceKey, result.data);
      setNotice(
        result.data.isDeliveryReady
          ? 'Preference saved.'
          : 'Preference saved. Push setup is still pending.',
      );
    },
    onError: () => {
      if (!alive.current) return;
      // A timeout may have committed. Refetch desired state; never claim an optimistic save.
      void queries.invalidateQueries({ queryKey: settingsKey });
      void queries.invalidateQueries({ queryKey: preferenceKey });
    },
    onSettled: () => {
      writing.current = false;
    },
  });
  const save = (kind: 'PAUSE' | 'CHAT', value: boolean) => {
    if (writing.current) return;
    writing.current = true;
    setNotice(null);
    mutation.mutate({ kind, value });
  };
  const available = settings.data?.isAvailable === true;
  const busy = mutation.isPending;
  const error =
    mutation.error?.message ?? settings.error?.message ?? preference.error?.message ?? null;
  return (
    <DiscoverySheet
      title={conversationId === undefined ? 'Notifications' : 'Chat notifications'}
      onClose={onClose}
      busy={busy}
    >
      <AppText variant="title">Your attention. Your rules.</AppText>
      <AppText>
        Every chat starts silent. Opt in to the ones you want on your radar—your choices sync across
        your account.
      </AppText>
      {settings.isPending ? (
        <AppText accessibilityRole="progressbar">Loading notification preferences…</AppText>
      ) : !available ? (
        <AppText>Push setup pending. Messaging still works.</AppText>
      ) : !settings.data?.isDeliveryReady ? (
        <AppText>Preferences can be saved, but push delivery is not configured yet.</AppText>
      ) : null}
      {conversationId === undefined ? null : (
        <View style={styles.card}>
          <Pressable
            style={styles.row}
            accessibilityRole="switch"
            accessibilityLabel="Notify me for this chat"
            accessibilityState={{
              checked: preference.data?.isEnabled === true,
              disabled: !available || preference.data === undefined || busy,
              busy,
            }}
            disabled={!available || preference.data === undefined || busy}
            onPress={() => save('CHAT', !preference.data?.isEnabled)}
          >
            <AppText variant="button" style={styles.label}>
              Notify me for this chat
            </AppText>
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Switch
                value={preference.data?.isEnabled === true}
                disabled={!available || preference.data === undefined || busy}
                trackColor={{ false: colors.border, true: colors.plum }}
              />
            </View>
          </Pressable>
          <AppText variant="caption">
            {preference.data?.isEnabled
              ? 'Selected for alerts. Account pause and device permissions still apply.'
              : 'Silent: no push alerts or notification-tray entries.'}
          </AppText>
        </View>
      )}
      <View style={styles.card}>
        <Pressable
          style={styles.row}
          accessibilityRole="switch"
          accessibilityLabel="Pause all chat notifications"
          accessibilityState={{
            checked: settings.data?.isPaused === true,
            disabled: !available || busy,
            busy,
          }}
          disabled={!available || busy}
          onPress={() => save('PAUSE', !settings.data?.isPaused)}
        >
          <AppText variant="button" style={styles.label}>
            Pause all chat notifications
          </AppText>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Switch
              value={settings.data?.isPaused === true}
              disabled={!available || busy}
              trackColor={{ false: colors.border, true: colors.plum }}
            />
          </View>
        </Pressable>
        <AppText variant="caption">
          Pausing keeps your individual chat choices. Resuming won’t replay missed alerts.
        </AppText>
      </View>
      <AppText variant="caption">
        When push is connected, alerts will say “New message on ProDate.” No names or message
        previews.
      </AppText>
      <ErrorNotice message={error} />
      {notice === null ? null : <AppText accessibilityLiveRegion="polite">{notice}</AppText>}
      {error === null ? null : (
        <QuietButton
          label="Refresh notification preferences"
          disabled={busy}
          onPress={() => {
            void settings.refetch();
            if (available && conversationId !== undefined) void preference.refetch();
          }}
        />
      )}
    </DiscoverySheet>
  );
}
const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
