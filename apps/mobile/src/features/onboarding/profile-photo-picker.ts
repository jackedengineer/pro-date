import type { LocalProfilePhoto } from '../../api/profile-photos';
import { ImageManipulator, SaveFormat, type ImageManipulatorContext } from 'expo-image-manipulator';
import {
  launchImageLibraryAsync,
  type ImagePickerOptions,
  type ImagePickerResult,
} from 'expo-image-picker';

const minimumEdge = 600;
const maximumEdge = 2048;

interface ProfilePhotoPickerDependencies {
  launchImageLibrary: (options: ImagePickerOptions) => Promise<ImagePickerResult>;
  manipulate: (uri: string) => ImageManipulatorContext;
}

const defaultDependencies: ProfilePhotoPickerDependencies = {
  launchImageLibrary: launchImageLibraryAsync,
  manipulate: (uri) => ImageManipulator.manipulate(uri),
};

export async function pickProfilePhoto(
  dependencies: ProfilePhotoPickerDependencies = defaultDependencies,
): Promise<LocalProfilePhoto | null> {
  const result = await dependencies.launchImageLibrary({
    allowsEditing: false,
    allowsMultipleSelection: false,
    mediaTypes: ['images'],
    quality: 1,
    selectionLimit: 1,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];

  if (asset === undefined || asset.width < minimumEdge || asset.height < minimumEdge) {
    throw new Error('Choose a photo with both edges at least 600 px.');
  }

  const context = dependencies.manipulate(asset.uri);

  if (asset.width > maximumEdge || asset.height > maximumEdge) {
    if (asset.width >= asset.height) {
      context.resize({ height: null, width: maximumEdge });
    } else {
      context.resize({ height: maximumEdge, width: null });
    }
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });

  return {
    height: saved.height,
    mimeType: 'image/jpeg',
    uri: saved.uri,
    width: saved.width,
  };
}
