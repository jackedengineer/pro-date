# Store readiness

What stands between the app and a Google Play or App Store release. Update the status column as
items land. Last reviewed 10 November 2026.

## Builds

| Item                           | Status      | Notes                                                                 |
| ------------------------------ | ----------- | --------------------------------------------------------------------- |
| Store identifier               | Done        | `dev.jacked.merge` on Android and iOS                                 |
| EAS project and build profiles | Done        | `apps/mobile/eas.json`: development, preview, production              |
| Android development build      | Done        | Dev client APK from EAS, built 10 November 2026                       |
| Android signing key            | Done        | Generated and held by EAS. Enrol in Play App Signing on first upload  |
| iOS development build          | Not started | Needs an Apple Developer Program membership and a registered device   |
| Dev-only `/preview` route      | To do       | Redirects in production, but should not be in the store bundle at all |

## Required by both stores

| Item                   | Status  | Notes                                                                                                                                                                                             |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account deletion       | Live    | Profile tab, then Delete account. `DELETE /v1/users/me` removes data, images and the sign-in. Web link: https://merge.jacked.dev/delete-account. Not yet exercised end to end with a real account |
| Privacy policy         | Live    | https://merge.jacked.dev/privacy, linked from the welcome screen and the Profile tab                                                                                                              |
| Terms of use           | Live    | https://merge.jacked.dev/terms. Governed by Indian law                                                                                                                                            |
| Production sign-in     | Missing | Clerk is on a development instance (`pk_test`). Production needs its own instance on a domain you own. SMS codes do not reach India yet, so email is the working route                            |
| Report and block       | Done    | Present on profiles, requests and chats                                                                                                                                                           |
| Child safety standards | Live    | https://merge.jacked.dev/safety, with the in-app report route and a named contact                                                                                                                 |
| Age gate               | Partly  | The app collects a birthday and requires 18+. The store listing must be rated 18+                                                                                                                 |
| Crash reporting        | Missing | Nothing reports crashes from release builds                                                                                                                                                       |
| Push notifications     | Off     | Code exists and is disabled. Android needs a Firebase project and `google-services.json`                                                                                                          |

## Google Play

| Item                         | Status      | Notes                                                                                                                          |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Developer account            | Done        | Personal account `jackedengineer`, which already has Portl in closed testing                                                   |
| Trader status declaration    | Owner       | Due by February 2027. A legal declaration only the account owner can make                                                      |
| Create the app               | Done        | Merge, `dev.jacked.merge`, free app, English (UK). Created 10 November 2026 with the owner's confirmation of both declarations |
| Closed test                  | Not started | Personal accounts need 12 testers opted in for 14 days before production access                                                |
| Store listing                | Drafted     | Text, content answers and data safety in `docs/release/store-listing.md`. Feature graphic and real screenshots still needed    |
| Content rating questionnaire | Owner       | Answers are a declaration about the app's content                                                                              |
| Data safety form             | Drafted     | See `docs/release/store-listing.md`. The owner confirms and submits                                                            |
| Target audience and ads      | Owner       | 18+, no ads                                                                                                                    |
| Service account for uploads  | Not started | Lets `eas submit` upload builds. Optional; the first upload can be manual                                                      |

## App Store

| Item                           | Status      | Notes                                                                 |
| ------------------------------ | ----------- | --------------------------------------------------------------------- |
| Apple Developer Program        | Unknown     | USD 99 a year. Needed for any iOS build on a device                   |
| App record, bundle ID, signing | Not started | EAS can manage certificates once the membership exists                |
| App privacy details            | Not started | Apple's equivalent of the data safety form                            |
| Review sign-in                 | Not started | Reviewers need a way past the one-time code, such as a review account |
| Screenshots                    | Not started | 6.9" and 6.5" iPhone sizes                                            |
