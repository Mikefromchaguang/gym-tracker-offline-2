# Local Gym Tracker - Design Document

## Overview
A fully local gym tracker mobile app for Android that enables users to create workout templates, track exercises with reps and weights, and view workout history. All data is stored locally with no authentication required.

## Design Principles
- **Mobile Portrait (9:16)** - All screens optimized for one-handed usage
- **iOS-like Design** - Clean, minimalist interface following Apple HIG standards
- **Offline-First** - All data persisted locally using AsyncStorage
- **Minimal Friction** - Quick workout logging, minimal taps to complete exercises

---

## Screen List

### 1. **Home Screen** (Tab: Home)
Main dashboard showing today's workout status and quick actions.

**Content:**
- Date header (e.g., "Tuesday, Jan 15")
- "Start Workout" button (primary action)
- Today's completed workouts (if any) with summary
- Quick stats: Total exercises today, Total volume
- Recent workouts list (last 3-5)

**Functionality:**
- Tap "Start Workout" → Workout Selection Sheet
- Tap recent workout → View Workout Details
- Pull-to-refresh to reload data

---

### 2. **Workout Selection Sheet** (Modal)
Modal sheet that appears when user taps "Start Workout" or "New Workout".

**Content:**
- Search bar to filter templates
- List of saved workout templates
- "Create New Workout" button at bottom

**Functionality:**
- Tap template → Start Active Workout
- Tap "Create New Workout" → Workout Builder Screen

---

### 3. **Workout Templates Tab**
Browse, create, edit, and delete workout templates.

**Content:**
- List of all saved templates
- Each template card shows: Name, number of exercises, last used date
- Floating action button "+" to create new template
- Swipe actions: Edit, Duplicate, Delete

**Functionality:**
- Tap template → Edit Template Screen
- Tap "+" → Workout Builder Screen
- Long-press template → Show context menu (Edit, Duplicate, Delete)

---

### 4. **Workout Builder Screen**
Create or edit a workout template.

**Content:**
- Template name input field
- List of exercises in template
- "Add Exercise" button
- "Save Template" button
- "Cancel" button

**Functionality:**
- Add exercises by tapping "Add Exercise"
- Reorder exercises via drag-and-drop or up/down buttons
- Delete exercise via swipe or delete button
- Save template with validation

---

### 5. **Exercise Selector Sheet** (Modal)
Modal to add exercises to a template.

**Content:**
- Search bar to find exercises
- Predefined exercise list (Bench Press, Squats, Deadlift, etc.)
- "Create Custom Exercise" option

**Functionality:**
- Tap exercise → Add to template with default sets/reps
- Tap "Create Custom Exercise" → Custom Exercise Modal

---

### 6. **Active Workout Screen**
Real-time workout tracking during an active session.

**Content:**
- Workout name and elapsed time
- Current exercise card with:
  - Exercise name
  - Set counter (e.g., "Set 1 of 3")
  - Reps input field
  - Weight input field (with unit toggle: kg/lbs)
  - "Log Set" button
  - Completed sets list below
- Navigation: Previous/Next exercise buttons
- "Finish Workout" button

**Functionality:**
- Log reps and weight for each set
- Tap "Log Set" → Record set, move to next set input
- Swipe left/right or tap Previous/Next → Navigate exercises
- Tap "Finish Workout" → Workout Summary Screen

---

### 7. **Workout Summary Screen**
Post-workout summary and confirmation.

**Content:**
- Workout name and total duration
- Total exercises completed
- Total volume (sum of all reps × weight)
- List of all exercises with sets completed
- "Save Workout" button
- "Discard" button

**Functionality:**
- Tap "Save Workout" → Save to history, return to Home
- Tap "Discard" → Discard without saving, return to Home

---

### 8. **Workout History Tab**
View past workouts and track progress.

**Content:**
- Calendar view or date-based list
- Each workout entry shows: Date, workout name, duration, exercises count
- Tap workout → View Workout Details

**Functionality:**
- Tap workout → Workout Details Screen
- Swipe to delete workout
- Filter by date range (optional)

---

### 9. **Workout Details Screen**
View detailed information about a completed workout.

**Content:**
- Workout name, date, duration
- All exercises with sets, reps, and weights
- Total volume calculation
- "Delete Workout" button
- "Edit Workout" button (optional)

**Functionality:**
- Tap "Delete Workout" → Confirm delete
- Tap "Edit Workout" → Edit Workout Screen (optional)

---

### 10. **Settings Tab** (Optional)
App configuration and preferences.

**Content:**
- Weight unit preference (kg/lbs)
- Theme preference (Light/Dark)
- About section
- Clear all data (with confirmation)

**Functionality:**
- Toggle weight unit → Update app state
- Toggle theme → Update app theme
- Tap "Clear All Data" → Confirm and delete all data

---

## Primary User Flows

### Flow 1: Create Workout Template
1. User taps "Templates" tab
2. User taps "+" button
3. User enters template name
4. User taps "Add Exercise"
5. User selects exercise from list
6. User confirms exercise (default: 3 sets × 8-12 reps)
7. User repeats steps 4-6 for more exercises
8. User taps "Save Template"
9. Template saved and appears in list

### Flow 2: Log a Workout
1. User taps "Start Workout" on Home
2. User selects template from modal
3. Active Workout screen opens
4. For each exercise:
   - User enters reps in first set
   - User enters weight
   - User taps "Log Set"
   - User repeats for remaining sets
   - User taps "Next" to move to next exercise
5. User taps "Finish Workout"
6. Workout Summary screen shows
7. User taps "Save Workout"
8. Workout saved to history

### Flow 3: View Workout History
1. User taps "History" tab
2. User sees list of past workouts
3. User taps a workout
4. Workout Details screen shows all exercises and sets
5. User can delete or edit workout

---

## Color Choices

| Element | Color | Usage |
|---------|-------|-------|
| **Primary** | #0a7ea4 (Teal) | Buttons, active states, highlights |
| **Background** | #ffffff (Light) / #151718 (Dark) | Screen background |
| **Surface** | #f5f5f5 (Light) / #1e2022 (Dark) | Cards, input fields |
| **Foreground** | #11181C (Light) / #ECEDEE (Dark) | Primary text |
| **Muted** | #687076 (Light) / #9BA1A6 (Dark) | Secondary text, hints |
| **Success** | #22C55E (Green) | Completed sets, success feedback |
| **Error** | #EF4444 (Red) | Delete actions, error states |

---

## Key Interactions

- **Haptic Feedback**: Light haptic on button taps, success haptic on workout completion
- **Animations**: Subtle fade-in for modals, smooth transitions between screens
- **Input Validation**: Prevent empty template names, validate numeric inputs for reps/weight
- **Undo/Redo**: Not required for MVP; focus on quick logging

---

## Data Model (Local Storage)

```
WorkoutTemplate {
  id: string (UUID)
  name: string
  exercises: Exercise[]
  createdAt: timestamp
  updatedAt: timestamp
}

Exercise {
  id: string (UUID)
  name: string
  sets: number (default: 3)
  reps: number (default: 8)
  weight?: number
  unit: "kg" | "lbs"
}

CompletedWorkout {
  id: string (UUID)
  templateId: string
  name: string
  startTime: timestamp
  endTime: timestamp
  exercises: CompletedExercise[]
}

CompletedExercise {
  id: string (UUID)
  name: string
  sets: CompletedSet[]
}

CompletedSet {
  setNumber: number
  reps: number
  weight: number
  unit: "kg" | "lbs"
}
```

---

## MVP Scope

**In Scope:**
- Create and manage workout templates
- Log workouts with reps and weights
- View workout history
- Local storage only (AsyncStorage)
- Dark/Light theme toggle
- Weight unit preference (kg/lbs)

**Out of Scope (Future):**
- Cloud sync
- User authentication
- Social features
- Advanced analytics
- Rest timer between sets
- Exercise form videos
- Barcode scanning for weights

