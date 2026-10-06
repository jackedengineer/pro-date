import type { ProfilePhoto } from '@pro-date/contracts';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { LocalProfilePhoto } from '../../api/profile-photos';
import { ProfilePhotosScreen } from './profile-photos-screen';

const localPhoto: LocalProfilePhoto = {
  height: 1200,
  mimeType: 'image/jpeg',
  uri: 'file:///photo.jpg',
  width: 960,
};

function photo(index: number): ProfilePhoto {
  return {
    deliveryUrl: `https://res.cloudinary.com/pro-date/image/upload/v1/photo-${index}.jpg`,
    height: 1200,
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    position: index,
    width: 960,
  };
}

describe('ProfilePhotosScreen', () => {
  it('loads the draft and keeps continue disabled until four photos exist', async () => {
    const loadPhotos = jest.fn().mockResolvedValue([photo(0), photo(1), photo(2)]);
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={loadPhotos}
        pickPhoto={jest.fn()}
        uploadPhoto={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText('3 / 6 committed')).toBeTruthy());
    expect(view.getByLabelText('Lead profile photo')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Add photo 4' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Commit photos and continue' })).toBeDisabled();
  });

  it('picks, normalizes, and uploads into the selected slot', async () => {
    const pickPhoto = jest.fn().mockResolvedValue(localPhoto);
    const uploadPhoto = jest.fn().mockResolvedValue([photo(0)]);
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={jest.fn().mockResolvedValue([])}
        pickPhoto={pickPhoto}
        uploadPhoto={uploadPhoto}
      />,
    );

    await waitFor(() => expect(view.getByRole('button', { name: 'Add photo 1' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Add photo 1' }));

    expect(pickPhoto).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledWith(localPhoto, 0));
    expect(view.getByLabelText('Lead profile photo')).toBeTruthy();
  });

  it('keeps the existing draft when photo selection is cancelled', async () => {
    const uploadPhoto = jest.fn();
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={jest.fn().mockResolvedValue([])}
        pickPhoto={jest.fn().mockResolvedValue(null)}
        uploadPhoto={uploadPhoto}
      />,
    );

    await waitFor(() => expect(view.getByRole('button', { name: 'Add photo 1' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Add photo 1' }));

    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  it('reorders photos accessibly and commits the visible order', async () => {
    const completePhotos = jest.fn().mockResolvedValue(undefined);
    const photos = [photo(0), photo(1), photo(2), photo(3)];
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={completePhotos}
        loadPhotos={jest.fn().mockResolvedValue(photos)}
        pickPhoto={jest.fn()}
        uploadPhoto={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText('4 / 6 committed')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Move photo 2 earlier' }));
    await fireEvent.press(view.getByRole('button', { name: 'Commit photos and continue' }));

    expect(completePhotos).toHaveBeenCalledWith([
      photos[1]?.id,
      photos[0]?.id,
      photos[2]?.id,
      photos[3]?.id,
    ]);
  });

  it('shows a recoverable API error without clearing selected photos', async () => {
    const loadPhotos = jest.fn().mockRejectedValue(new Error('Photo uploads are not configured yet.'));
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={loadPhotos}
        pickPhoto={jest.fn()}
        uploadPhoto={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByText('Photo uploads are not configured yet.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Retry loading photos' }));
    expect(loadPhotos).toHaveBeenCalledTimes(2);
  });
});
