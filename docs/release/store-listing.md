# Store listing and declarations (draft)

Drafts for the Google Play and App Store forms, written from what the code does. Everything here
is a declaration made in the account owner's name, so the owner reviews and submits it.

## Listing text

| Field                         | Limit | Draft                                                            |
| ----------------------------- | ----- | ---------------------------------------------------------------- |
| App name                      | 30    | Merge: People, not profiles                                      |
| Short description (Play)      | 80    | Like a line someone wrote. If they like you back, you’re merged. |
| Subtitle (App Store)          | 30    | Dating for curious minds                                         |
| Category                      | —     | Dating (Play), Lifestyle or Social Networking (App Store)        |
| Contact email                 | —     | trainwithchirag@gmail.com                                        |
| Privacy policy                | —     | https://merge.jacked.dev/privacy                                 |
| Account deletion link (Play)  | —     | https://merge.jacked.dev/delete-account                          |
| Child safety standards (Play) | —     | https://merge.jacked.dev/safety                                  |
| Support URL (App Store)       | —     | https://merge.jacked.dev/support                                 |

### Full description

> Merge is a dating app built around what people write, not only how they look.
>
> Every profile has photos and three short answers. Like the one thing that caught your eye and
> say why. That’s a pull request. If they like you back, you’re merged, and the conversation
> starts from something specific instead of “hey”.
>
> **How it works**
>
> - Answer three prompts and add four to six photos.
> - Browse one profile at a time. Like a photo or an answer, with an optional comment.
> - Review the pull requests you receive. Merge the ones you like.
> - Chat with your merges, with replies and reactions.
>
> **Made with care**
>
> - Free, with no advertising.
> - Your exact location is never stored or shown, only your area.
> - Hide your gender, pronouns or height whenever you like.
> - Report or block anyone from their profile, a request or a chat.
> - Delete your account and everything in it from the Profile tab.
>
> Merge is for adults aged 18 and over. It is an independent project by one developer.

## Google Play: content and audience

| Question                                    | Answer                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| Target age                                  | 18 and over only                                                                |
| Ads                                         | No                                                                              |
| App access                                  | Sign-in required. Review needs a way past the one-time code (see Review access) |
| Content rating: category                    | Social networking / dating                                                      |
| Users can interact or exchange content      | Yes: text messages, photos, written answers                                     |
| Users can share their location with others  | Yes: approximate area and distance only                                         |
| User-generated content is moderated         | Report and block in the app; reports reviewed by the developer                  |
| Purchases                                   | None                                                                            |
| News, health, finance, government, gambling | No                                                                              |

## Google Play: data safety

Data is encrypted in transit. Users can request deletion. No data is shared with third parties;
the providers listed in the privacy policy only process data for the app. Every item below is
collected for **app functionality** (and account management where noted), and is required unless
marked optional.

| Category            | Data type                    | Notes                                                                  |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Location            | Approximate location         | Rounded to about one kilometre before it is stored                     |
| Personal info       | Name                         | Display name                                                           |
| Personal info       | Email address                | Optional: either email or phone is used to sign in. Account management |
| Personal info       | Phone number                 | Optional, as above. Account management                                 |
| Personal info       | User IDs                     | Internal account ID                                                    |
| Personal info       | Sexual orientation           | Implied by who the member wants to meet. Not shown on the profile      |
| Personal info       | Other info                   | Date of birth, gender, pronouns, height, relationship intent           |
| Photos and videos   | Photos                       | Four to six profile photos chosen by the member                        |
| Messages            | Other in-app messages        | Chat messages and reactions                                            |
| App activity        | Other user-generated content | Prompt answers and comments on likes                                   |
| App activity        | App interactions             | Likes, passes, blocks and reports                                      |
| Device or other IDs | Device or other IDs          | Push notification token. Only once notifications are switched on       |

Not collected: precise location, financial info, health info, contacts, calendar, audio, files,
web browsing, installed apps, crash logs and diagnostics (until crash reporting is added).

## App Store: privacy details

Not used for tracking. All linked to the member's identity, for app functionality.

| Apple category | Data                                                            |
| -------------- | --------------------------------------------------------------- |
| Contact info   | Name, email address, phone number                               |
| Location       | Coarse location                                                 |
| User content   | Photos, messages, other user content (prompt answers, comments) |
| Identifiers    | User ID, and device ID once notifications are on                |
| Sensitive info | Sexual orientation (implied by who the member wants to meet)    |
| Other data     | Date of birth, gender, height                                   |

## Review access

Both stores review the app signed in, and sign-in uses a one-time code a reviewer cannot receive.
Before submitting, create a review account and give the stores its details. Clerk supports a
fixed test code for designated test addresses on development instances; a production instance
needs a real mailbox the reviewer's code can be read from, or a dedicated review sign-in.

## Assets still needed

| Asset                  | Size                                         | Status                                                                                                      |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| App icon               | 512 x 512 (Play), 1024 x 1024 (App Store)    | Source exists at `apps/mobile/assets/brand/icon.png`                                                        |
| Feature graphic (Play) | 1024 x 500                                   | To make                                                                                                     |
| Phone screenshots      | At least 2 (Play); 6.9" and 6.5" (App Store) | Take from a real build. The stills in `docs/showcase` are illustrations, and the stores expect the real app |
