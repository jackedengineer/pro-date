export const DISCOVERY_TAB_IDS = ['discover', 'requests', 'merged', 'profile'] as const;
export type DiscoveryTab = (typeof DISCOVERY_TAB_IDS)[number];

/** Narrows a URL parameter to a real tab. */
export const isDiscoveryTab = (value: unknown): value is DiscoveryTab =>
  DISCOVERY_TAB_IDS.some((id) => id === value);
