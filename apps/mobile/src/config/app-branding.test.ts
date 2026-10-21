import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import appConfig from '../../app.json';

describe('Merge native branding', () => {
  it('renames the product without replacing existing app and session identifiers', () => {
    expect(appConfig.expo.name).toBe('Merge');
    expect(appConfig.expo.slug).toBe('pro-date');
    expect(appConfig.expo.scheme).toBe('prodate');
    expect(appConfig.expo.ios.bundleIdentifier).toBe('com.prodate.mobile');
    expect(appConfig.expo.android.package).toBe('com.prodate.mobile');
  });

  it('configures a native launch mark with no artificial startup delay', () => {
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-splash-screen',
      {
        backgroundColor: '#FAF8F5',
        image: './assets/brand/splash.png',
        imageWidth: 180,
        resizeMode: 'contain',
      },
    ]);
    expect(appConfig.expo).toHaveProperty('icon', './assets/brand/icon.png');
    expect(appConfig.expo.android).toHaveProperty('adaptiveIcon', {
      foregroundImage: './assets/brand/adaptive-foreground.png',
      monochromeImage: './assets/brand/adaptive-monochrome.png',
      backgroundColor: '#5A2E4F',
    });
  });

  it.each([
    ['icon.png', 1024],
    ['adaptive-foreground.png', 1024],
    ['adaptive-monochrome.png', 1024],
    ['splash.png', 1024],
    ['merge-mark.png', 256],
    ['favicon.png', 64],
  ])('ships a correctly sized %s PNG', (name, size) => {
    const png = readFileSync(resolve(__dirname, '../../assets/brand', name));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });
});
