---
title: OmenBot Privacy Policy
---

Last updated: February 20, 2026

This privacy policy explains what data OmenBot (Discord application ID `1262631779316269116`, hereinafter "the App") collects while providing its service, how that data is used, where it is stored, and how users can manage their own data.

The App is self-hosted and maintained by the Daily Routines developers. It runs only in their own Discord server and serves users through application commands in direct messages.

## Data We Collect

The App does not read or store any Discord message content. All data comes from information users submit by running application commands, together with the identity Discord supplies with each interaction.

| Data | Description |
| --- | --- |
| Discord user ID | Primary key of all local records, used to attribute credentials and language settings to a specific user |
| Discord username | Used to identify users in administrative commands and in review records. The username is refreshed on each verification or submission, so it always reflects the current name |
| Language preference | The interface language a user selects through `/language` |
| Game account credential | The Final Fantasy XIV account identifier a user submits through `/verify`, used to grant authorization to the associated service |
| Credential timestamps | Verification time, expiry time, and next verification time of a credential |
| Credential change cooldown | The most recent credential change time, used to limit how often credentials may be changed |
| Daily query counter | The number of `/query-cid` calls made on the current day, used for rate limiting |
| Sponsorship application data | The author name, platform name, order ID, and screenshot links a user submits through `/verify` for sponsorship, along with review status and outcome |
| Audit log | Records of administrative operations and service events, including the operator's Discord user ID, username, and the action performed |

About server member roles: the App requests the Server Members privileged intent in order to read a user's roles in the server, which determines the number and validity period of credentials they may receive, whether they are a server booster, which language role should be synchronized, and whether they hold administrative permissions. Role information is read on demand at the moment a command runs and is **never written to the database or persisted in any form**. The App does not track member joins, leaves, or online status, and does not collect member data from servers other than its own.

The App does not collect IP addresses, does not use cookies, does not build user profiles, and does not serve advertising.

## How We Use Data

The data listed above is used solely to operate the App's features:

- Determining how many credentials a user receives and for how long, and granting authorization to the associated service accordingly
- Recording and displaying verification status so users can review and change credentials themselves
- Granting the corresponding role reward to server boosters
- Synchronizing a user's language role
- Limiting credential change frequency and daily query counts to prevent abuse
- Processing sponsorship applications and retaining operation records for administrative purposes

## Where Data Is Stored

All data is stored in a local SQLite database on the maintainer's self-hosted server. It is not exposed to any third party and is not used for advertising, analytics, or profiling.

Audit and runtime logs are written only to local log files on the maintainer's own server and may contain Discord user IDs and usernames.

## Data Transfers

To provide its features, the App sends the necessary authorization information to the associated Final Fantasy XIV authorization service:

- When granting or revoking authorization, the account credential submitted by the user and the authorization duration

Apart from these requests, which are required for the service to function, the App does not provide data to any third party, and does not sell, rent, or otherwise trade user data.

The App runs on the Discord platform. Discord's own handling of data is governed by Discord's privacy policy and is outside the scope of this policy.

## Retention and Deletion

Data is retained for as long as the user makes use of the service. The App does not automatically purge historical records.

Users may contact the server administrators at any time to have all of their records deleted, including Discord user ID, username, language preference, game account credentials, sponsorship application data, and related counters. After deletion, service authorizations tied to that user are revoked as well, and verification is required again to restore them.

## Contact

For questions about this policy, or to access, correct, or delete your data, please reach out through:

- Daily Routines Discord server: <https://discord.gg/MDvv8Ejntw>
- Project repository: <https://github.com/Dalamud-DailyRoutines>

## Changes to This Policy

This policy may be updated as the App's features change. Updated versions are published on this page, and the last updated date at the top is revised accordingly.
