import { resolveBootstrapState } from './resolve-bootstrap-state';

describe('resolveBootstrapState', () => {
  it('waits while required resources are loading', () => {
    expect(resolveBootstrapState({ fontError: null, fontsLoaded: false })).toBe('loading');
  });

  it('continues when required resources are ready', () => {
    expect(resolveBootstrapState({ fontError: null, fontsLoaded: true })).toBe('ready');
  });

  it('surfaces a loading failure instead of hanging on the splash screen', () => {
    expect(
      resolveBootstrapState({
        fontError: new Error('Font download failed'),
        fontsLoaded: false,
      }),
    ).toBe('error');
  });
});
