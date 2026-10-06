import type { ProfilePhoto } from '@pro-date/contracts';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the draft and keeps continue disabled until four photos exist', async () => {
    const loadPhotos = jest.fn().mockResolvedValue([photo(0), photo(1), photo(2)]);
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={loadPhotos}
        pickPhoto={jest.fn()}
        removePhoto={jest.fn()}
        uploadPhoto={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText('3 / 6 committed')).toBeTruthy());
    expect(view.getByLabelText('Lead profile photo')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Add photo 4' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Commit photos and continue' })).toBeDisabled();
  });

  it('centers the empty-slot affordance within the full photo card', async () => {
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={jest.fn().mockResolvedValue([])}
        pickPhoto={jest.fn()}
        removePhoto={jest.fn()}
        uploadPhoto={jest.fn()}
      />,
    );

    const firstCard = await view.findByRole('button', { name: 'Add photo 1' });
    expect(firstCard).toHaveStyle({ aspectRatio: 0.78, width: '47%' });
    expect(view.getByTestId('empty-photo-content-0')).toHaveStyle({
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    });
  });

  it('keeps sparse server positions in their actual grid slots', async () => {
    const uploadPhoto = jest.fn().mockResolvedValue([photo(0), photo(1)]);
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={jest.fn().mockResolvedValue([photo(1)])}
        pickPhoto={jest.fn().mockResolvedValue(localPhoto)}
        removePhoto={jest.fn()}
        uploadPhoto={uploadPhoto}
      />,
    );

    await waitFor(() => expect(view.getByLabelText('Profile photo 2')).toBeTruthy());
    expect(view.queryByLabelText('Lead profile photo')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Add photo 1' }));
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledWith(localPhoto, 0));
  });

  it('renders uploaded photos as a centered cover crop', async () => {
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={jest.fn().mockResolvedValue([photo(0)])}
        pickPhoto={jest.fn()}
        removePhoto={jest.fn()}
        uploadPhoto={jest.fn()}
      />,
    );

    const image = await view.findByTestId('profile-photo-image-0');
    expect(image).toHaveProp('cachePolicy', 'memory-disk');
    expect(image).toHaveProp('contentFit', 'cover');
    expect(image).toHaveProp('contentPosition', { left: '50%', top: '50%' });
  });

  it('picks, normalizes, and uploads into the selected slot', async () => {
    const pickPhoto = jest.fn().mockResolvedValue(localPhoto);
    const uploadPhoto = jest.fn().mockResolvedValue([photo(0)]);
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={jest.fn().mockResolvedValue([])}
        pickPhoto={pickPhoto}
        removePhoto={jest.fn()}
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
        removePhoto={jest.fn()}
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
        removePhoto={jest.fn()}
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
    const loadPhotos = jest
      .fn()
      .mockRejectedValue(new Error('Photo uploads are not configured yet.'));
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={loadPhotos}
        pickPhoto={jest.fn()}
        removePhoto={jest.fn()}
        uploadPhoto={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByText('Photo uploads are not configured yet.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Retry loading photos' }));
    expect(loadPhotos).toHaveBeenCalledTimes(2);
  });

  it('confirms before deleting a photo from storage', async () => {
    const removePhoto = jest.fn().mockResolvedValue([]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    const view = await render(
      <ProfilePhotosScreen
        completePhotos={jest.fn()}
        loadPhotos={jest.fn().mockResolvedValue([photo(0)])}
        pickPhoto={jest.fn()}
        removePhoto={removePhoto}
        uploadPhoto={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByRole('button', { name: 'Remove photo 1' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Remove photo 1' }));

    expect(alert).toHaveBeenCalledWith('Remove this photo?', expect.any(String), expect.any(Array));
    await waitFor(() => expect(removePhoto).toHaveBeenCalledWith(photo(0).id));
  });
});
