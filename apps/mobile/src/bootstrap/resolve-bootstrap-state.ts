export type BootstrapState = 'loading' | 'ready' | 'error';

interface BootstrapResources {
  fontError: Error | null;
  fontsLoaded: boolean;
}

export function resolveBootstrapState({
  fontError,
  fontsLoaded,
}: BootstrapResources): BootstrapState {
  if (fontError !== null) {
    return 'error';
  }

  return fontsLoaded ? 'ready' : 'loading';
}
