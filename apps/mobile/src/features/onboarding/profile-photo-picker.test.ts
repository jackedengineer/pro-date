import { pickProfilePhoto } from './profile-photo-picker';

describe('pickProfilePhoto', () => {
  it('returns null when the system picker is cancelled', async () => {
    const launchImageLibrary = jest.fn().mockResolvedValue({ assets: null, canceled: true });
    const manipulate = jest.fn();

    await expect(pickProfilePhoto({ launchImageLibrary, manipulate })).resolves.toBeNull();
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('rejects an image whose shortest edge is below the profile minimum', async () => {
    const launchImageLibrary = jest.fn().mockResolvedValue({
      assets: [{ height: 599, uri: 'file:///small.heic', width: 1200 }],
      canceled: false,
    });

    await expect(
      pickProfilePhoto({ launchImageLibrary, manipulate: jest.fn() }),
    ).rejects.toThrow('Choose a photo with both edges at least 600 px.');
  });

  it('normalizes a large library image to an upload-ready JPEG', async () => {
    const saveAsync = jest.fn().mockResolvedValue({
      height: 1536,
      uri: 'file:///normalized.jpg',
      width: 2048,
    });
    const renderAsync = jest.fn().mockResolvedValue({ saveAsync });
    const resize = jest.fn();
    const manipulate = jest.fn().mockReturnValue({ renderAsync, resize });
    const launchImageLibrary = jest.fn().mockResolvedValue({
      assets: [{ height: 3000, uri: 'file:///large.heic', width: 4000 }],
      canceled: false,
    });

    await expect(pickProfilePhoto({ launchImageLibrary, manipulate })).resolves.toEqual({
      height: 1536,
      mimeType: 'image/jpeg',
      uri: 'file:///normalized.jpg',
      width: 2048,
    });
    expect(launchImageLibrary).toHaveBeenCalledWith({
      allowsEditing: false,
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });
    expect(manipulate).toHaveBeenCalledWith('file:///large.heic');
    expect(resize).toHaveBeenCalledWith({ height: null, width: 2048 });
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.85, format: 'jpeg' });
  });

  it('keeps an already efficient image at its original dimensions', async () => {
    const saveAsync = jest.fn().mockResolvedValue({
      height: 1200,
      uri: 'file:///normalized.jpg',
      width: 900,
    });
    const renderAsync = jest.fn().mockResolvedValue({ saveAsync });
    const resize = jest.fn();
    const manipulate = jest.fn().mockReturnValue({ renderAsync, resize });
    const launchImageLibrary = jest.fn().mockResolvedValue({
      assets: [{ height: 1200, uri: 'file:///portrait.png', width: 900 }],
      canceled: false,
    });

    await pickProfilePhoto({ launchImageLibrary, manipulate });

    expect(resize).not.toHaveBeenCalled();
  });
});
