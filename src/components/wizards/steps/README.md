# Wizard Steps Directory

Individual step components used across different wizard workflows for competition and team creation.

## Challenge Creation Steps (QuickChallengeWizard)

- **SelectActivityStep.tsx** - Step for selecting challenge activity type (running, cycling, pushups, etc.)
- **SelectMetricStep.tsx** - Step for selecting competition metric based on activity (distance, duration, reps, etc.)
- **SelectDurationStep.tsx** - Step for selecting challenge duration (3/7/14/30 days)
- **SelectWagerStep.tsx** - Step for selecting wager amount in sats (or free challenge)

## General Wizard Steps

- **ChallengeReviewStep.tsx** - Final review step for global challenge creation with opponent and challenge details
- **ChallengeTypeStep.tsx** - Step for selecting challenge type and activity category
- **ChooseOpponentStep.tsx** - Step for selecting challenge opponents and participants
- **FirstEventStep.tsx** - Step for creating the first event in a league setup
- **LeagueSettingsStep.tsx** - Step for configuring league settings and parameters
- **ReviewConfirmStep.tsx** - Final review and confirmation step for various wizards
- **ReviewLaunchStep.tsx** - Review and launch step for competition publishing
- **SuccessScreen.tsx** - Success confirmation screen after wizard completion
- **TeamBasicsStep.tsx** - Step for setting basic team information and details
- **TeamWalletSetupStep.tsx** - Step for configuring team Bitcoin wallet settings
- **UserSearchStep.tsx** - Step for searching and selecting any Nostr user globally for challenges
- **WagerAmountStep.tsx** - Step for setting competition entry fees and prize amounts

## Deprecated/Unused

- **ActivityConfigurationStep.tsx** - (DEPRECATED) Previously combined all challenge config in single scrolling view - replaced by individual Select*Step components
- **ArbitratorSelectionStep.tsx** - (DEPRECATED) Previously allowed selecting team captains as arbitrators - feature removed for simplicity