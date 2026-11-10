// Executed by build.mjs against the bundled output, then deleted. Bundled CommonJS dependencies
// may touch __dirname, __filename or require only when a code path runs (Cloudinary reads its
// package.json on the first delivery URL), so a bundle that starts cleanly can still throw on a
// real request. This exercises those paths before an image is shipped.
import { createCloudinaryProfilePhotoClient } from './media/profile-photo-provider.js';

const client = createCloudinaryProfilePhotoClient({
  apiKey: 'bundle-smoke',
  apiSecret: 'bundle-smoke',
  cloudName: 'bundle-smoke',
});

const url = client.buildDeliveryUrl('pro-date/users/bundle-smoke/profile/photo', 1);
if (!url.startsWith('https://res.cloudinary.com/bundle-smoke/'))
  throw new Error(`Unexpected Cloudinary delivery URL from the bundle: ${url}`);

const signature = client.signUpload({
  format: 'jpg',
  overwrite: false,
  public_id: 'pro-date/users/bundle-smoke/profile/photo',
  timestamp: 1,
});
if (!/^[a-f0-9]{40,}$/.test(signature))
  throw new Error('Cloudinary signing did not produce a hex signature inside the bundle.');

console.log('Bundle smoke check passed.');
