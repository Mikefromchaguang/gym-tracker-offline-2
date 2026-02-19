# Offline Gym Tracker

A local-first workout tracking app built with React Native + Expo, made exclusively with Manus and Github Copilot in VS Code. Create unlimited workout routines, customize unlimited exercises, and visually track your progress while keeping your data completely offline.

## What This App Is (and Isn't)

This tracker is designed for for people who have used other gym trackers before, have graduated past exercise videos and social feeds, and now want the useful features many trackers lock behind recurring subscription fees.

**What you get:**
- Intuitive UI with meaningful metrics
- Fully customizable exercises with unlimited routines
- Week-by-week progression analytics

**What you won't find:**
- Ads
- Social feeds or followers
- Paid training plans
- Exercise videos

Just track, grind, and progress.

---

## Getting Started

### 1. Initial Setup

The app has three main sections:
- **Home**: Log bodyweight, create/edit routines, start workouts
- **Analytics**: View graphs and progression metrics
- **Profile**: Configure exercises, app preferences, and manage data

**First steps:**
1. Go to **Profile > Preferences** and set your gender and weight unit (kg or lbs)
2. Go to **Home** and log your bodyweight
   - Default is 70 kg
   - Required for accurate bodyweight movement tracking
   - If not logged daily, previous day's weight carries over
   - View bodyweight trends in **Analytics**

### 2. Configure Your Exercises

- The app includes a modest list of common lifts you can view at **Profile > Exercises**
- Search by name or muscle group
- Add unlimited custom exercises
- Tap any exercise to view stats and charts
- Tap the edit icon to customize (all exercises are customizable)

#### Exercise Types

Exercise type determines volume calculation:

| Type | Calculation |
|------|-------------|
| **Weighted** | `reps × weight` |
| **Bodyweight** | `reps × bodyweight` |
| **Weighted bodyweight** | `reps × (bodyweight + added weight)` |
| **Assisted bodyweight** | `reps × (bodyweight - assistance)` |
| **Doubled** | `reps × weight × 2` (for two-handed dumbell/cable exercises, log weight for one side, volume doubles) |

#### Muscle Contributions

Muscle contributions power volume data in your analytics charts:

- **Primary muscles**: Get full credit for each set, with volume based on your configured percentage
- **Secondary muscles**: Get fractional credit for sets and volume based on configured percentages
- All percentages must total 100%
- Even predefined contributions can be modified

### 3. Create Routines & Work Out

**Creating routines:**
- Go to **Home** to create a routine
- Add exercises, configure sets/reps/weights
- (Optional) Group exercises into supersets
- Tap a set number to remove it or mark as **Warmup** (warmup sets don't count toward volume)
- Tap the exercise name for **Actions**:
  - View/edit exercise details
  - Replace or remove exercise
  - Set rest time and toggle rest timer on/off
- Use arrows to reorder exercises

**During workouts:**
- Start a quick workout or use a routine
- Mark sets complete as you go (only completed sets count toward volume and PRs)
- Back out of an active workout to navigate freely, but return to the workout to complete it
- Tap a set number to remove the set, mark it as a **Warmup** set (warmups don't count toward volume and PRs), or mark it as a **Failure** set (failure sets are used to estimate your max rep values)
- ⚠️ **Known bug**: If you end a workout from the bottom-page active workout banner, it sometimes doesn't actually end. While in this state, if you start another workout, the title will rapidly switch back and forth indicating two active workouts. Close and reopen the app to fix this.

### 4. Track Your Progress

#### During Workouts
Each exercise card shows:
- 1RM and previous best set
- Completed volume vs. routine targets (red/green indicators)

#### Analytics Page

**Body Weight Tracker**
- Line chart with rolling average and linear regression
- Shows average change per selected period

**Stats by Muscle**
- **Week-over-Week Volume**: Stacked bar graph comparing current vs. previous week
  - Darker = primary activation, lighter = secondary
  - Previous week in grey, current week is overlaid
  - Bars remain red until volume exceeds the previous week (green is good)
- **Current Week Sets**: Set count per muscle
  - Yellow: 1-9 sets | Green: 10-20 sets | Red: 20+ sets
- **Muscle Volume**: Radar chart for selected muscles

**Muscles Worked**
- Muscle map showing which muscles were used in the selected period

**Weekly Volume**
- Week-over-Week cumulative volume comparison
- Daily volume bar chart

**Exercise Details Page**

Go to **Profile > Exercises** and tap an exercise with a **Data** tag to view stats

- View weekly/all time stats
- View estimated rep maxes in chart or graph form. Data points show sets you marked as **Failure**
- View exercise-specific progression charts 

---

## Best Practices

- Log bodyweight daily (or at least weekly) for bodyweight-based exercises
- In supersets, mark the set complete after finishing the first exercise so that rest time indicates when you should start the first exercise again
- **Always back up data before app updates**—The app is made to handle updates gracefully but with no guarantees, and new features may invalidate old metadata

---

## Data & Storage

All core data is stored locally using AsyncStorage. No cloud sync required.

**Storage keys** (see `lib/storage.ts`):
- `gym_tracker_templates`
- `gym_tracker_workouts`
- `gym_tracker_settings`
- `gym_tracker_custom_exercises`
- `gym_tracker_predefined_exercise_customizations`
- `gym_tracker_body_weight`
- `gym_tracker_active_workout`
- `gym_tracker_exercise_volume`


## Development

### Prerequisites

- Node.js (v18+)
- pnpm (v9.12.0)
- iOS Simulator (macOS) or Android Emulator, or a physical device

### Install

```bash
pnpm install
```

### Run

Start Metro + the local dev server (web by default):

```bash
pnpm dev
```

Platform shortcuts:

```bash
pnpm ios
pnpm android
```

Note: `pnpm ios` / `pnpm android` start Expo for that platform.

Generate a QR code for local testing (handy for physical devices):

```bash
pnpm qr
```

### Project Structure

```
app/
  (tabs)/              # Main tab navigation screens
  _hidden/             # Non-tab screens (modals, flows)
components/            # UI + feature components
lib/                   # Context, storage, business logic
constants/             # Constants, theme, predefined data
scripts/               # Build and utility scripts
```

### Testing

```bash
pnpm test
```

Other useful checks:

```bash
pnpm check      # TypeScript type checking
pnpm lint       # ESLint
pnpm format     # Prettier
```

---

## Contributing

This repo is public mainly for transparency. You're welcome to:

- **Fork** and modify for personal use
- **Open issues** to report bugs or suggest features
- **Reference** the code for your own projects

However, I'm not actively managing pull requests or community contributions. If you find something useful here, feel free to take it and make it your own, though beware this repo was built completely using AI agents.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

Use it, fork it, learn from it—no strings attached.

---

## Acknowledgments

- **Muscle Map**: Built with [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter)



