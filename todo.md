# Local Gym Tracker - TODO

## Core Features

### Data & Storage
- [x] Design and implement local storage schema (AsyncStorage)
- [x] Create data models for WorkoutTemplate, Exercise, CompletedWorkout
- [x] Implement CRUD operations for templates
- [x] Implement CRUD operations for completed workouts
- [x] Add data persistence layer

### Navigation & Tabs
- [x] Set up tab navigation (Home, Templates, History, Settings)
- [x] Create tab icons and mappings
- [x] Implement tab bar styling

### Home Screen
- [x] Display today's date and greeting
- [x] Show "Start Workout" button
- [x] Display today's completed workouts summary
- [x] Show recent workouts list (last 3-5)
- [x] Implement pull-to-refresh

### Workout Templates Tab
- [x] Display list of all templates
- [x] Implement template card with name, exercise count, last used date
- [x] Add floating action button for new template
- [ ] Implement swipe actions (Edit, Duplicate, Delete)
- [x] Add template deletion with confirmation

### Workout Builder Screen
- [x] Create template name input field
- [x] Implement exercise list with reordering
- [x] Add "Add Exercise" button
- [x] Create Exercise Selector modal
- [x] Implement predefined exercise list
- [ ] Add "Create Custom Exercise" option
- [x] Implement save template with validation
- [x] Add cancel button

### Active Workout Screen
- [ ] Create workout selection modal
- [x] Implement exercise card with set counter
- [x] Add reps and weight input fields
- [ ] Add weight unit toggle (kg/lbs)
- [x] Implement "Log Set" button
- [x] Display completed sets list
- [x] Add Previous/Next exercise navigation
- [x] Implement "Finish Workout" button
- [x] Add elapsed time display

### Workout Summary Screen
- [x] Display workout name and duration
- [x] Show total exercises completed
- [x] Calculate and display total volume
- [x] List all exercises with sets
- [x] Implement "Save Workout" button
- [ ] Implement "Discard" button (combined with finish)

### Workout History Tab
- [x] Display list of past workouts by date
- [x] Show workout summary (name, duration, exercises count)
- [x] Implement tap to view details
- [ ] Add swipe to delete

### Workout Details Screen
- [x] Display workout metadata (name, date, duration)
- [x] Show all exercises with sets, reps, weights
- [x] Calculate and display total volume
- [x] Add "Delete Workout" button with confirmation
- [ ] Add "Edit Workout" button (optional)

### Settings Tab
- [x] Add weight unit preference toggle (kg/lbs)
- [x] Add theme preference toggle (Light/Dark)
- [x] Add about section
- [x] Add "Clear All Data" option with confirmation

### UI & Styling
- [x] Create custom components (buttons, cards, inputs)
- [x] Implement consistent color scheme
- [x] Add responsive layouts for different screen sizes
- [x] Implement dark mode support
- [x] Add loading states and empty states

### Interactions & Feedback
- [x] Add haptic feedback on button taps
- [x] Add success haptic on workout completion
- [ ] Implement smooth transitions between screens
- [x] Add input validation with error messages
- [x] Add confirmation dialogs for destructive actions

### Testing & Validation
- [ ] Test all user flows end-to-end
- [ ] Verify local storage persistence
- [ ] Test dark/light mode toggle
- [ ] Test weight unit conversion display
- [ ] Verify all buttons and navigation work

### Branding & Configuration
- [x] Generate custom app icon/logo
- [x] Update app.config.ts with app name and logo
- [x] Set up app colors and theme
- [x] Configure Android build settings

### Documentation & Delivery
- [ ] Create user guide (optional)
- [ ] Document data schema
- [ ] Prepare app for deployment


## Bug Fixes

- [x] Fix "Start Workout" button routing from home page (unmatched route error)
- [x] Fix active workout screen to load exercises from template
- [x] Implement add/delete exercises in active workout
- [x] Implement add/remove sets functionality
- [x] Fix reps and weight adjustment in active workout
- [x] Ensure workout data is properly logged on finish

## Recent Feature Requests

- [x] Convert active workout screen to single scrollable view with all exercises visible
- [x] Implement searchable exercise selector with autocomplete from predefined list
- [x] Create workout summary/report page after finishing workout
- [x] Fix finish workout routing to go to summary page instead of unmatched route

## Additional Feature Requests

- [x] Create report page for historical workouts (similar to summary page)
- [x] Add delete functionality for historical workouts with confirmation
- [x] Make workout details screen show report view

## UI/UX Improvements

- [x] Remove extra pages from tab menu (active-workout, templates/create, history/[id], workout-summary)
- [x] Create workout selection screen (quick workout vs template selection)
- [x] Create analytics page with exercise progress charts
- [x] Add analytics tab to main navigation

## Workout Features

- [x] Add checkbox to mark sets as complete during workout
- [x] Add configurable rest timer for each exercise (default 3 mins)
- [x] Add option to update template with current values after workout
- [x] Add muscle group associations to exercises (primary and secondary)
- [x] Update exercise data model to include muscle groups
- [x] Update predefined exercises list with muscle group data

## Bug Fixes & Improvements

- [x] Fix rest timer to show per-exercise instead of global
- [x] Make rest timer persist for each exercise and not disappear on skip
- [x] Add rest timer configuration UI for each exercise
- [x] Show rest timer below exercise name with countdown

## Analytics Page Redesign

- [x] Create radial/radar chart for muscle group volume distribution
- [x] Calculate total volume per muscle group for past 7 days
- [x] Add date range selector for past 7 days
- [x] Show muscle group breakdown with volume data
- [x] Add set count per muscle group statistics

## Template Page Redesign

- [x] Make template creation/editing page identical to active workout page
- [x] Allow configuration of sets, reps, weights, rest timers per exercise in templates
- [x] Add "Save as Template" button to workout summary page (for quick workouts)
- [x] Add "Update Template" button to workout summary page (for template-based workouts)
- [x] Implement template saving from workout summary
- [x] Implement template updating from workout summary

## Home Page Redesign

- [x] Combine home page and templates page into single home screen
- [x] Add "Start Quick Workout" button at top
- [x] Add templates section showing all created templates
- [x] Add "Create New Template" button in templates section
- [x] Allow selecting template from home page to start workout
- [x] Remove Templates tab from navigation (merge into home)

## Template Set Management Fix

- [x] Redesign template creation to use per-set configuration (like active workout)
- [x] Remove "Sets" input field from template exercise config
- [x] Add individual set rows with reps and weight inputs
- [x] Add "Add Set" button for each exercise
- [x] Add delete button for each set
- [x] Match the active workout page layout exactly

## Layout Fixes

- [x] Fix input box sizing on workout screen
- [x] Add clear labels for reps and weight inputs
- [x] Improve set row layout to match Hevy design
- [x] Fix input box sizing on template screen
- [x] Add clear labels for template set inputs

## Bug Fixes - Navigation & Validation

- [x] Fix delete template buttons on home page
- [x] Add duplicate template name validation
- [x] Review and fix all dead-end navigation buttons
- [x] Ensure all buttons navigate to correct pages

## Bug Fixes - Post Revert

- [x] Fix "Save as Template" button on workout summary to prompt for name and save
- [x] Compact exercise sections on template and workout screens (reduce vertical space)
- [x] Redesign analytics page to show only weekly muscle distribution with compact layout
- [x] Remove breakdown by muscle group section from analytics page

## Layout Alignment Fixes

- [x] Fix input box alignment with labels on workout screen
- [x] Fix input box alignment with labels on template creation screen
- [x] Fix analytics bars to fit properly on screen without overflow

## Hevy-Style Layout Redesign

- [x] Redesign active workout set rows to match Hevy layout: SET | PREVIOUS | KG | REPS | RPE | checkbox
- [x] Redesign template creation set rows to match Hevy layout
- [ ] Add PREVIOUS column showing last weight/reps used
- [ ] Add RPE (Rate of Perceived Exertion) field
- [ ] Add set completion checkbox
- [x] Ensure proper column alignment and spacing

## Input Box Sizing Fixes

- [x] Increase input box width on active workout screen
- [x] Increase input box height on active workout screen
- [x] Increase input box width on template creation screen
- [x] Increase input box height on template creation screen

## Template Creation Layout Adjustments

- [x] Remove active rest timer from template creation page
- [x] Move notes field to top of exercise section
- [x] Move rest time configuration to top of exercise section

## Backend Cleanup

- [ ] Review and remove unnecessary backend service references
- [ ] Verify app is truly standalone local with no backend dependencies
- [ ] Update app configuration to reflect local-only status

## Backend Removal

- [x] Remove backend build scripts from package.json
- [x] Remove unused backend dependencies
- [x] Verify app still builds and runs correctly
- [x] Confirm build platform recognizes app as local-only

## Input Box Styling Fixes

- [x] Fix reps and weight input boxes on active workout screen to have equal fixed widths
- [x] Fix reps and weight input boxes on template creation screen to have equal fixed widths
- [x] Ensure inputs look neat and professional side by side

## Set Completion Checkbox

- [x] Add completed field to set data structure
- [x] Add checkbox UI at the end of each set row on active workout screen
- [x] Implement toggle functionality for marking sets as complete
- [x] Add visual styling for completed sets (e.g., strikethrough or opacity change)

## Input Box Fixed Width Adjustment

- [x] Change input boxes from flex-1 to fixed equal widths on active workout screen
- [x] Change input boxes from flex-1 to fixed equal widths on template creation screen
- [x] Ensure boxes fit neatly side by side within card width

## History Page Removal and Custom Exercise Creation

- [ ] Remove history tab from navigation
- [ ] Keep workout data storage (reps, weight, volume, dates, bodyweight, progress)
- [ ] Add custom exercise creation feature
- [ ] Add exercise name input field
- [ ] Add primary muscle group dropdown
- [ ] Add secondary muscle group dropdown
- [ ] Store custom exercises with predefined exercises
- [ ] Make custom exercises available in workout and template creation
- [ ] Fix analytics bar chart display issue

## History Page Removal and Custom Exercise Creation

- [x] Remove history tab from navigation
- [x] Keep workout data storage (reps, weight, volume, dates, bodyweight, progress)
- [x] Add custom exercise creation feature with name input
- [x] Add primary muscle group dropdown
- [x] Add secondary muscle group dropdown
- [x] Store custom exercises and make them available in workouts/templates
- [x] Fix analytics bar chart display issue

## Body Weight Logging and Bodyweight Exercises

- [x] Add body weight log data structure to types
- [x] Add body weight storage methods to storage.ts
- [x] Add body weight logger UI to home page
- [x] Add exercise type field (weighted/bodyweight) to ExerciseMetadata
- [x] Update custom exercise creation form to include exercise type selection
- [x] Update predefined exercises to mark bodyweight exercises
- [x] Auto-populate weight field with logged body weight for bodyweight exercises in workouts
- [x] Auto-populate weight field with logged body weight for bodyweight exercises in templates
- [x] Test body weight logging and auto-population functionality

## Exercise Detail View and Analytics Redesign

- [x] Create exercise detail screen with exercise name and stats header
- [x] Calculate and display estimated 1RM for each exercise
- [x] Display heaviest weight lifted for each exercise
- [x] Implement line chart for weight progression over time
- [x] Add time period filters (3 weeks, 6 months, all time)
- [x] Make exercises on exercise page clickable to open detail view
- [x] Redesign analytics page with sleek, professional styling
- [x] Add button on analytics page to navigate to exercises page
- [x] Optimize analytics page layout and visual hierarchy

## Complete Backend Infrastructure Removal

- [x] Remove server directory completely
- [x] Remove any remaining backend configuration files
- [x] Verify build platform recognizes app as local-only

## Analytics Bar Chart Redesign

- [x] Make bar chart more vertically condensed
- [x] Display all info for each bar on a single line
- [x] Make bars thinner with lower profile
- [x] Show all muscle groups even when there's no data
- [x] Display bar and stats only when data exists for that muscle group

## Analytics Chart Sorting

- [x] Sort analytics bar chart from highest volume to lowest volume

## Body Weight UI and Chart Improvements

- [x] Fix body weight input box height on home page
- [x] Display saved body weight as nice blue header on home page
- [x] Add body weight line chart to analytics page
- [x] Add time period filters to body weight chart (week, month, 6 months, all time)
- [x] Update exercise detail chart time periods to week, month, 6 months, all time
- [x] Change exercise page stats to show current week volume/sets only

## Body Weight Tap to Edit Fix and Bodyweight Exercise Chart Update

- [x] Fix tap to edit functionality for body weight display on home page
- [x] Update exercise detail charts to show reps instead of weight for bodyweight exercises
- [x] Update chart labels and axis for bodyweight exercises

## Tab Bar Cleanup

- [x] Hide templates, workout-selector, workout-summary, and active-workout screens from tab bar
- [x] Keep only Home, Analytics, Exercises, and Settings tabs visible

## Additional Tab Bar Cleanup

- [x] Identify any remaining unwanted tabs in navigation bar
- [x] Hide exercises subdirectory from tab bar
- [x] Ensure only index, analytics, exercises, and settings appear as tabs

## Exercise Search Bar

- [x] Add search input field to Exercises page
- [x] Implement filtering logic for exercise name
- [x] Implement filtering logic for muscle groups (primary and secondary)
- [x] Update UI to display filtered results

## Exercise Modal and Multiple Secondary Muscles

- [x] Add Lats to muscle group list
- [x] Update CustomExercise type to support multiple secondary muscles
- [x] Update PREDEFINED_EXERCISES to support multiple secondary muscles
- [x] Fix add exercise modal to be scrollable
- [x] Update exercise creation UI to allow multiple secondary muscle selection
- [x] Add exercise creation button to template creation page
- [x] Update exercise display to show all secondary muscles

## Home Icon Change

- [x] Change home tab icon from house to dumbbell

## Lats Muscle Group Fix

- [x] Fix Lats not appearing in primary muscle group dropdown
- [x] Fix Lats not appearing in secondary muscle groups checkboxes

## Quick Weight Adjustment Buttons

- [x] Add +/- buttons next to weight inputs on active workout screen
- [x] Add +/- buttons next to weight inputs on template creation screen
- [x] Implement increment/decrement logic with configurable step size (e.g., +2.5kg)
- [x] Add haptic feedback when buttons are pressed

## Exercise Detail Page - Time Period Filtering

- [x] Apply time period filters to total sets and total volume (not just chart)
- [x] Keep 1RM constant (all-time) while filtering other metrics
- [x] Update stats when time period is changed

## Settings Page Redesign

- [x] Remove About section from Settings page
- [x] Remove Dark/Light mode toggle from Settings page
- [x] Implement CSV export functionality for all app data
- [x] Implement CSV import functionality to restore data
- [x] Add Export Data button to Settings page
- [x] Add Import Backup File button to Settings page
- [x] Fix Delete Data button to clear all data (templates, workouts, exercises, body weight logs)
- [x] Implement two-layer delete confirmation modal
- [x] Add "for real" text entry requirement for delete confirmation
- [x] Add visual list of what will be deleted in confirmation modal

## Critical Bug Fixes (Jan 17)

- [x] Template creation add exercise flow - selecting exercise now properly adds to template and returns
- [x] Workout set row layout - restored compact one-line layout without redundant labels
- [x] Template set row layout - restored compact one-line layout without redundant labels

## Exercise Reordering in Templates

- [x] Add drag-and-drop functionality to reorder exercises in template creation
- [x] Add drag handle icon to each exercise card
- [x] Implement smooth drag animation with visual feedback
- [x] Update exercise order in state when drag completes

## Template/Workout Screen Fixes (Jan 17)

- [x] Fix Add Exercise to be simple picker modal (not separate screen)
- [x] Create separate Create Exercise screen for new exercises with muscle groups
- [x] Make Create Exercise accessible from template/workout and return after
- [x] Fix set row layout: inline labels `[input] Reps [input] kg`
- [x] Remove header row labels (SET, PREV, KG, REPS)
- [x] Use standard input box heights on set rows

## Set Row & Scrolling Fixes (Jan 18)

- [x] Move +/- adjustment buttons from weight to reps input
- [x] Auto-fill new sets with previous set's weight and reps values
- [x] Fix scrolling issue when many exercises in template/workout

## UX Audit & Fixes (Jan 18)

- [x] Audit all screens for navigation that abandons work
- [x] Convert Create Exercise navigation to inline modal (template & workout)
- [x] Ensure all screens are scrollable (verified: all main screens use ScrollView)
- [x] Delete unused create-exercise.tsx file

## Bug Fixes (Jan 18 - Batch 2)

- [x] Fix template name input keyboard closing after each letter
- [x] Add rest timer edit functionality during workout
- [x] Add rest timer reset button during workout
- [x] Fix volume logging to only count checked (completed) sets
- [x] Fix Save as Template button on workout summary
- [x] Fix backup export to use native share sheet for easy accessle access

## Workout Notes and Unit Conversion (Jan 18)

- [x] Add notes field to CompletedWorkout type (already existed)
- [x] Add notes textarea to active workout screen (at bottom, before Finish button)
- [x] Display notes on workout summary screen
- [x] Implement unit conversion function (kg ↔ lbs)
- [x] Update all weight displays to show current unit from settings
- [x] Update all volume calculations to use current unit
- [x] Convert stored weights when displaying based on settings unit (store in kg, display in user's unit)
- [x] Update workout screen to show current unit labels
- [x] Update template screen to show current unit labels
- [x] Update analytics to show current unit labels
- [x] Update exercise detail to show current unit labels
- [x] Update workout summary to show current unit labels
- [x] Update home page to show current unit labels

## Unit Conversion Fixes & Missing Exercises (Jan 18)

- [ ] Create body weight history modal on home page with date and weight list
- [ ] Apply unit conversion to body weight history modal entries
- [ ] Fix analytics body weight chart to update values when switching kg/lbs
- [ ] Fix exercise detail charts to update values when switching kg/lbs
- [ ] Add kg/lbs unit label to total volume display on exercise detail page
- [ ] Add 19 missing exercises to predefined exercise list (Goblet Squat, Kettlebell Swing, Leg Press, Hip Adduction Machine, Hip Abduction Machine, Seated Leg Curl, Leg Extension, Standing Calf Raise, Machine Shoulder Press, Reverse Machine Fly, Hammer Curl, Dumbbell Shrug, Assisted Pull-Up, Machine Bicep Curl, Barbell Row, Cable Close-Grip Seated Row, Face Pull, Captain's Chair Leg Raise, Torso Rotation Machine, Machine Crunch, Machine Back Extension)

## Unit Conversion Fixes & Missing Exercises (Jan 18)

- [x] Add body weight history modal on home page with unit conversion
- [x] Fix analytics body weight chart to convert units when switching kg/lbs
- [x] Fix exercise detail charts to convert units when switching kg/lbs
- [x] Add unit label to exercise detail total volume display
- [x] Add 19 missing exercises to predefined exercise list (Goblet Squat, Kettlebell Swing, Hip Adduction/Abduction Machines, Seated Leg Curl, Leg Extension, Standing Calf Raise, Machine Shoulder Press, Reverse Machine Fly, Hammer Curl, Dumbbell Shrug, Assisted Pull-Up, Machine Bicep Curl, Barbell Row, Cable Close-Grip Seated Row, Face Pull, Captain's Chair Leg Raise, Torso Rotation Machine, Machine Crunch, Machine Back Extension)

## Bug Fixes (Jan 18 - Batch 3)

- [x] Add unsaved changes warning when navigating away from template creation page
- [x] Add unsaved changes warning when navigating away from active workout page
- [x] Fix weight input bug - showing 0.0 and not allowing edits
- [x] Display whole numbers only in weight inputs (no decimals)

## Bodyweight Exercise Logic & Removal Confirmations (Jan 18)

- [x] Hide weight input for bodyweight exercises in active workout
- [x] Hide weight input for bodyweight exercises in template creation
- [x] Show only reps input for bodyweight exercises
- [x] Calculate volume for bodyweight exercises using current body weight × reps
- [x] Add "Remove set?" confirmation dialog when clicking red X on a set
- [x] Add "Remove exercise?" confirmation dialog when clicking trash icon on an exercise

## Assisted Bodyweight Exercise Support (Jan 18)

- [x] Add "assisted-bodyweight" as new exercise type to ExerciseType
- [x] Update exercise creation UI to include assisted-bodyweight category option
- [x] Show weight input for assisted bodyweight exercises on workout screen
- [x] Show weight input for assisted bodyweight exercises on template screen
- [x] Update volume calculation to use (current body weight - assistance weight) × reps
- [x] Add assisted bodyweight exercises to predefined list (Assisted Pull-Up, Assisted Dip, Assisted Chin-Up)
- [x] Test assisted exercise creation and volume calculation

## Template Loading Bug (Jan 18)

- [x] Fix: Starting workout from template does not load sets, weights, and reps
- [x] Investigate how template data is passed to active-workout screen
- [x] Ensure all template exercise data (sets, reps, weight) is properly loaded into workout

## Template Card Redesign (Jan 18)

- [x] Replace delete button with "Start Workout" button on template cards
- [x] Add small red trash icon in corner of template card for deletion
- [x] Update card layout to accommodate new button arrangement

## Drag-and-Drop Template Reordering (Jan 18)

- [x] Create draggable template card component with gesture handling
- [x] Implement reordering logic when dragging templates
- [x] Add visual feedback during drag (elevation, opacity)
- [x] Persist template order in storage
- [x] Update home page to use draggable template list
- [x] Test drag-and-drop on different screen sizes

## Template Loading & Workout Management (Jan 18)

- [x] Fix: Template sets/weights/reps still not loading into active workout
- [x] Debug why CompletedSet objects aren't being created from template data
- [x] Add "Quit Without Saving" button to active workout screen
- [x] Add confirmation dialog for quitting without saving
- [x] Add "Update Template" option after completing workout
- [x] Add "Save as New Template" option after completing workout
- [x] Implement logic to save workout data (exercises, sets, weights, reps, timers) as template

## Template Loading Deep Investigation (Jan 18)

- [x] Examine Exercise type definition to see how template data is structured
- [x] Check how templates store sets/weights/reps (single values vs array)
- [x] Review template creation screen to see how it saves exercise data
- [x] Identify mismatch between template storage format and workout loading logic
- [x] Fix template-to-workout conversion to properly create all sets with correct weights/reps
- [x] Test end-to-end: create template with multiple sets → start workout → verify all sets appear

## Template Loading Debug (Jan 18)

- [x] Add console logging to template save to verify setDetails array
- [x] Add console logging to template load to verify data structure
- [x] Test: Create new template with 3 sets at different weights
- [x] Test: Start workout from template and verify all sets appear
- [x] Fix any data flow issues discovered

## Android Template Loading Bug (Jan 18)

- [x] Investigate AsyncStorage serialization in gym-context
- [x] Check if setDetails array is being properly saved to AsyncStorage
- [x] Check if setDetails array is being properly loaded from AsyncStorage
- [x] Fix serialization/deserialization to ensure setDetails persists on Android
- [x] Add migration logic to convert old templates without setDetails
- [ ] Test on real Android device after fix

## Systematic Android Template Fix (Jan 18)

- [x] Review template save logic - ensure setDetails is ALWAYS created, never empty
- [x] Add validation in template save to reject exercises without setDetails
- [x] Strengthen workout loading with multiple fallback strategies (3 strategies)
- [x] Simplify data conversion to eliminate edge cases
- [x] Improve migration logic with better validation and logging
- [ ] Test on Android device after fixes

## Critical Bug Fixes (Jan 18)

- [x] Add extensive logging to track setDetails through save/load cycle
- [x] Add logging to TemplateStorage.save to see what's being saved
- [x] Add logging to TemplateStorage.getAll to see what's being loaded
- [x] Fix: Discarded workouts persist instead of being cleared
- [x] Ensure quit workout properly clears active workout state
- [ ] Test on Android device to verify setDetails is now working
- [ ] Test quit workout to verify state is cleared

## Workout Initialization Fix (Jan 18)

- [x] Fix quick workout to always start empty (no exercises)
- [x] Fix template workout to always load template data correctly
- [x] Ensure timer always starts at 0 for new workouts (reset startTime and elapsedTime on focus)
- [x] Ensure no leftover data from previous workouts (reset isInitialized flag on focus)
- [ ] Test: Start quick workout → should be empty with timer at 0
- [ ] Test: Start template workout → should have template exercises with timer at 0
- [ ] Test: Finish workout → start new workout → should be fresh

## Body Weight History Fix (Jan 18)

- [x] Fix body weight history list on homepage to display entries
- [x] Sort entries newest to oldest
- [x] Implement one-entry-per-day logic (keep only newest entry per day) using Map grouping by date
- [x] Update analytics chart to use filtered body weight data
- [x] Load weight history on mount (not just when opening modal)
- [ ] Test: Log multiple weights on same day → only newest should show
- [ ] Test: History list shows correct dates and weights in order

## Weight History Modal Safe Area Fix (Jan 18)

- [x] Add safe area padding to bottom of weight history modal for Android navigation bar
- [x] Ensure list starts at top of modal (not pushed down)
- [x] Test on Android device to verify content is not behind navigation bar

## Template Card Drag Handle (Jan 18)

- [x] Add drag handle icon to template cards (e.g., three horizontal lines icon)
- [x] Position drag handle in corner or side of card
- [x] Update drag gesture to only trigger when user drags from the handle area
- [x] Ensure rest of card remains tappable for other actions (edit, start workout)

## Exercise UI Consistency and Edit Feature (Jan 18)

- [x] Replace dropdown muscle group selector on exercise creation page with button-based selector (match workout modal design)
- [x] Add edit button to exercise detail page
- [x] Implement exercise editing for custom exercises
- [x] Implement exercise editing for default/predefined exercises
- [x] Ensure edited exercises save correctly and update throughout the app
- [x] Use same modal/form layout for both create and edit operations

## Exercise Edit Menu and Set Long-Press Removal (Jan 18)

- [x] Replace red trash icon with edit/pencil icon on exercise cards (template creation screen)
- [x] Replace red trash icon with edit/pencil icon on exercise cards (active workout screen)
- [x] Implement popup menu when tapping edit icon with two options: "Delete Exercise" and "Replace Exercise"
- [x] Implement "Replace Exercise" functionality that opens exercise picker modal
- [x] When replacing exercise, keep all existing sets with their weight and reps values
- [x] Remove red X button from sets on template creation screen
- [x] Remove red X button from sets on active workout screen
- [x] Implement long-press gesture on set numbers (e.g., "Set 1", "Set 2")
- [x] Show popup menu on long-press with "Remove Set" option
- [x] Ensure long-press menu works on both template creation and active workout screens

## Exercise Menu Bug Fixes (Jan 18)

- [x] Fix menu positioning - menus should appear near tap location, not center screen
- [x] Change set number interaction from long-press to regular tap
- [x] Fix set removal functionality - tapping "Remove Set" should actually remove the set

## Interactive Chart Upgrade with Victory Native (Jan 18)

- [x] Install victory-native and react-native-svg dependencies
- [x] Find all existing chart components (body weight, exercise progress)
- [x] Create reusable InteractiveLineChart component with victory-native
- [x] Implement CartesianChart with Line and smooth curves (curveType="monotoneX")
- [x] Add touch interaction using useChartPressState hook
- [x] Add tooltip showing Y value (weight/reps) and X value (date/session)
- [x] Highlight active data point with visible dot on press
- [x] Render X and Y axes with readable labels
- [x] Add subtle horizontal grid lines
- [x] Support dark/light mode with existing theme colors
- [x] Add line rendering animation on mount (animate={{ duration: 500 }})
- [x] Upgrade body weight tracking chart to use InteractiveLineChart
- [x] Upgrade exercise detail best weight chart to use InteractiveLineChart
- [x] Upgrade exercise detail best reps chart to use InteractiveLineChart
- [x] Test performance with large datasets (~1,000 points)
- [x] Ensure all charts work 100% offline with local data only

## Always-Visible Data Points on Charts (Jan 18)

- [x] Add Scatter to InteractiveLineChart for always-visible data point dots
- [x] Render small, subtle data point dots by default (radius 3.5)
- [x] On touch/press, visually emphasize the active data point (larger size with multi-layer circles)
- [x] Keep useChartPressState for interaction and tooltips
- [x] Ensure data points are visible without requiring touch interaction
- [x] Test that charts look complete and readable at rest

## Spider (Radar) Chart for Weekly Volume by Muscle Group (Jan 18)

- [x] Create SpiderChart component using react-native-svg (victory-native polar only supports pie charts)
- [x] Use Polygon for radar area with animated rendering
- [x] One axis per displayed muscle group
- [x] Normalize values so largest muscle group reaches outer radius
- [x] Animate chart rendering and updates (500ms smooth animation)
- [x] Display muscle group labels around perimeter
- [x] Show concentric grid lines for scale readability (5 levels)
- [x] Support dark/light mode with theme colors
- [x] Create muscle group selection modal with toggles/checkboxes
- [x] Validate minimum 3 muscle groups selected
- [x] Disable Apply button until at least 3 selected
- [x] Add spider chart to Analytics page below bar chart
- [x] Add header with title and edit icon
- [x] Calculate weekly volume by muscle group from workout data (uses existing allMuscleStats)
- [x] Filter chart data based on user selection
- [x] Re-normalize values after filtering
- [x] Animate transitions when selection changes

## Modal Safe Area Fix for Android Navigation Bar (Jan 18)

- [ ] Create shared ModalContainer component with safe area support
- [ ] Use useSafeAreaInsets() to get bottom inset dynamically
- [ ] Apply bottom padding equal to insets.bottom inside modal content
- [ ] Keep top and horizontal padding unchanged
- [ ] Find all existing modals in the codebase
- [ ] Update all modals to use ModalContainer wrapper
- [ ] Ensure scrolling content still works correctly within modals
- [ ] Test on Android to verify buttons/controls not obscured by navigation bar
- [ ] Verify iOS modal appearance unchanged

## Exercise History Auto-Population with Placeholders (Jan 18)

- [x] Create function to fetch most recent exercise data from completed workouts
- [x] When adding exercise to workout, look up most recent completed workout with that exercise
- [x] When adding exercise to template, look up most recent completed workout with that exercise
- [x] Add 1 set with historical reps/weight as greyed placeholders (not real values)
- [x] If no history exists, use "0" as greyed placeholders
- [x] Convert all set input fields from actual "0" values to placeholder="0"
- [x] Ensure placeholders are greyed out and inputs are empty until user types
- [x] Keep existing behavior: when adding new sets, copy real values from previous set
- [x] Historical data should not affect exercises already configured with real values
- [x] Test with exercises that have history and exercises without history

## Append (Custom) to Edited Default Exercises (Jan 18)

- [x] When editing a default/predefined exercise, append " (Custom)" to the name
- [x] This creates a new custom exercise with the modified attributes
- [x] Original default exercise remains unchanged and available
- [x] User can easily distinguish between original and custom version in exercise lists

## PR and Estimated 1RM Display on Exercise Cards (Jan 18)

- [x] Create function to calculate PR (personal record) weight from workout history
- [x] Create function to calculate estimated 1RM using Epley formula (weight * (1 + reps / 30))
- [x] For bodyweight exercises, calculate PR reps instead of PR weight
- [x] Add PR and Est 1RM display to exercise card headers in template creation screen
- [x] Add PR and Est 1RM display to exercise card headers in active workout screen
- [x] Show "PR: --" and "Est 1RM: --" when no history exists for an exercise
- [x] Display values next to muscle group badge at top of exercise card
- [x] Format values with proper units (lbs/kg for weight, reps for bodyweight)

## Body Weight Tracking Display Bug (Jan 19)

- [x] Investigate why new body weight entries are not showing in history modal
- [x] Investigate why new body weight entries are not showing in analytics chart
- [x] Check if data is being saved correctly to AsyncStorage
- [x] Check if data retrieval is filtering or sorting incorrectly
- [x] Fix home page to reload weight history after saving
- [x] Fix analytics page to reload body weight data when tab becomes active (useFocusEffect)
- [x] Verify exercise detail page charts work correctly (they read from context which updates immediately)
- [x] Test all charts update properly when new data is added


## PR Recognition System (Jan 19)

- [x] Create function to detect PRs by comparing workout sets against all historical workout data
- [x] Track three PR categories per exercise globally: Heaviest Weight, Highest Set Volume (weight × reps), Most Reps (bodyweight)
- [x] Create PR celebration modal component with motivational message
- [x] Modal shows one specific exercise name + "and X other exercises" if multiple PRs
- [x] Use 💪 emoji in motivational message
- [x] Update workout completion flow to detect PRs and show celebration modal before summary
- [x] Add PR badges below exercise name on workout summary screen
- [x] Use 🏆 trophy emoji + PR type and value (e.g., "🏆 Heaviest Weight: 225 lbs")
- [x] Ensure PRs are calculated correctly for bodyweight vs weighted exercises
- [x] Test with workouts that achieve PRs and workouts that don't


## PR Modal Bug Fixes (Jan 19)

- [ ] Fix PR modal not showing for quick workouts (non-template workouts)
- [ ] Fix heaviest weight calculation for assisted bodyweight exercises (should use body weight minus assistance weight)
- [ ] Verify PR detection works for all workout types (quick workout, template workout)
- [ ] Test assisted bodyweight exercises show correct PR values


## PR Modal Bug Fixes (Jan 19)

- [x] Fix PR modal not showing for quick workouts (non-template workouts)
- [x] Fix first-time exercises to show PRs and trigger celebration modal
- [x] Verify assisted bodyweight exercise weight calculation (already correct: bw - assistance)
- [x] Update tests to match new first-time exercise PR behavior
- [x] All 6 PR detection tests passing


## Weighted Bodyweight Exercise Type (Jan 19)

- [x] Add 'weighted-bodyweight' as new ExerciseType option in types.ts
- [x] Update exercise creation modal to show weighted-bodyweight option (4 buttons: Weighted, Bodyweight, Assisted, Weighted BW)
- [x] Update active workout screen to handle weighted-bodyweight (show weight input, calculate as bw + input)
- [x] Update template creation screen to handle weighted-bodyweight
- [x] Verify body weight fallback logic already uses most recent previous day BW (70kg only if never logged)
- [x] Verify PR detection correctly calculates weight for weighted-bodyweight exercises (weight stored as bw + added)
- [x] Verify exercise card PR display shows correct weight for weighted-bodyweight
- [x] All exercise types now supported: weighted, bodyweight, assisted-bodyweight, weighted-bodyweight


## Weighted-Bodyweight UI Completion (Jan 19)

- [x] Add weighted-bodyweight option to template creation exercise modal
- [x] Add weighted-bodyweight option to exercise detail edit modal (with flex-wrap for 2x2 grid)
- [x] Add weighted-bodyweight option to exercises list page create modal (with flex-wrap for 2x2 grid)
- [x] Update template creation screen weight input display for weighted-bodyweight
- [x] Verify all exercise type conditionals include weighted-bodyweight
- [x] All 4 exercise creation/edit locations now have weighted-bodyweight option


## Modal Bottom Safe Area Padding (Jan 19)

- [x] Find all modals in the app (15 modals total)
- [x] Add bottom safe area padding to exercise creation modals (workout, template, exercises page)
- [x] Add bottom safe area padding to exercise edit modal
- [x] Add bottom safe area padding to all other scrollable modals (exercise pickers, replace exercise)
- [x] Create reusable ModalBottomSheet component with built-in safe area padding
- [x] All bottom sheet modals now have proper padding to avoid Android nav bar overlap


## Analytics Muscle Group Chart Bug (Jan 19)

- [x] Investigate why custom exercises don't update muscle group bar chart (getExerciseMuscles only works for predefined)
- [x] Fix muscle group tracking for custom exercises (now looks up customExercises context)
- [x] Verify analytics page correctly counts all exercises (predefined + custom)
- [x] Custom exercises now properly tracked in muscle group stats and charts


## Danger Zone Separate Screen (Jan 19)

- [x] Create new danger-zone.tsx screen in app/(tabs)/settings/ folder
- [x] Add "Delete Workout Data Only" option (clears workouts but keeps exercises/templates)
- [x] Add "Delete All Data" option (complete reset)
- [x] Add confirmation modals for each deletion option
- [x] Update settings page to navigate to danger zone screen
- [x] Removed old inline delete modal from settings page


## Rest Timer Improvements (Jan 19)

- [x] Auto-start rest timer when user completes a set (clicks checkbox)
- [x] Add +15s button to timer (works even during countdown)
- [x] Add -15s button to timer (works even during countdown)
- [x] Timer buttons visible and accessible during countdown
- [x] Auto-start triggers when toggling set to completed state


## Rest Timer Behavior Changes (Jan 19)

- [x] Change timer button from "Pause" to "Stop"
- [x] Stop button resets timer to original duration (not pause)
- [x] Add audible ding/notification sound when timer completes (mixkit notification sound)
- [x] Timer now has Start/Stop behavior instead of Start/Pause


## Navigation Restructure - Profile Page (Jan 19)

- [x] Create new Profile page (app/(tabs)/profile.tsx)
- [x] Add button on Profile page linking to Exercises page
- [x] Update bottom navigation to replace Exercises tab with Profile tab
- [x] Exercises page hidden from tab bar but accessible via Profile
- [x] Nav bar now has only: Home, Analytics, Profile, Settings
- [x] Profile tab uses same list.bullet icon as Exercises previously used
- [x] Profile page ready for future feature additionsre feature additions


## UI Improvements - Timer, Title, and Exercise Stats (Jan 19)

- [x] Remove reset icon from rest timer (Stop button already resets)
- [x] Workout title already displayed above session timer (template name or "Quick Workout")
- [x] Add "Best Set" stat to exercise detail page (heaviest volume: weight × reps, weighted exercises only)
- [x] Reorganize exercise detail stats into two categories: "All Time" and "This Week"
- [x] All Time section: 1RM, Heaviest Weight, Best Set (weighted only)
- [x] This Week section: Total Sets, Total Volume
- [x] Calculate Best Set from all workout history for the exercise


## Navigation Simplification - 3 Tabs Only (Jan 19)

- [x] Add Settings button to Profile page
- [x] Remove Settings from bottom navigation
- [x] Bottom nav now shows only: Home, Analytics, Profile
- [x] Settings page hidden from tab bar but accessible via Profile
- [x] No other pages appear in bottom navigation (all hidden with href: null)


## Bottom Nav Icon Fix (Jan 19)

- [x] Investigate which screens are still showing in bottom navigation (templates.tsx was not hidden)
- [x] Ensure only Home, Analytics, Profile tabs are visible
- [x] Hide all other screens from bottom nav bar (added templates to hidden screens)
- [x] All screens except Home, Analytics, Profile now have href: null


## Fix Settings Nested Routes in Nav (Jan 19)

- [x] Move settings folder out of app/(tabs)/ to app/
- [x] Move danger-zone.tsx with settings folder
- [x] Profile page navigation link already uses correct path (/settings)
- [x] Remove settings from _layout.tsx since it's no longer in (tabs)
- [x] Settings and danger-zone now outside (tabs) so won't appear in nav


## Weighted Muscle Contribution System (Jan 19)

- [ ] Add muscleContributions field to ExerciseMetadata type (Record<MuscleGroup, number>)
- [ ] Update exercise storage to save/load muscle contributions
- [ ] Create shared utility function to calculate weighted volume/sets per muscle
- [ ] Add "Muscle Contribution" section to exercise creation modal
- [ ] Add "Muscle Contribution" section to exercise edit modal
- [ ] Implement auto-calculation: primary 70%, secondary split remaining 30%
- [ ] Add validation to ensure contributions sum to 100%
- [ ] Update contributions dynamically when muscle selections change
- [ ] Update analytics muscle volume calculation to use weighted contributions
- [ ] Update analytics muscle set count calculation to use weighted contributions
- [ ] Update muscle distribution bar chart to use weighted calculations
- [ ] Ensure all muscle stats globally use weighted logic (no mixing)


## Weighted Muscle Contribution System (Jan 19)

- [x] Add muscleContributions field to ExerciseMetadata type
- [x] Create shared weighted calculation utilities (volume split by %, sets: primary=1.0, secondary=fractional)
- [x] Create reusable MuscleContributionEditor component
- [x] Add Muscle Contribution UI to active workout create exercise modal
- [ ] Add Muscle Contribution UI to template creation create exercise modal
- [ ] Add Muscle Contribution UI to exercises page create modal
- [ ] Add Muscle Contribution UI to exercise detail edit modal
- [ ] Update analytics to use weighted muscle contributions
- [ ] Update muscle distribution bar chart with weighted calculations
- [ ] Test with various exercises and muscle combinations


## Muscle Contribution Fixes (Jan 19)

- [x] Fix MuscleContributionEditor to auto-adjust secondary percentages when primary changes
- [x] Revert analytics total volume/sets cards to use actual unweighted values
- [x] Keep weighted logic ONLY in muscle distribution bar chart and spider chart
- [x] Exercise detail page already uses actual totals (correct - no weighted logic needed for single exercise)
- [x] Verify home page shows actual workout totals (correct - no weighted logic)
- [x] Weighted logic now only applies to muscle-specific breakdowns, not overall totals


## Muscle Contribution UI Improvements (Jan 19)

- [x] Add visual labels to distinguish primary muscle from secondary muscles in MuscleContributionEditor
- [x] Show "Primary Muscle" label above first muscle percentage input
- [x] Show "Secondary Muscles" label above secondary muscle percentage inputs


## Complete Muscle Contribution Integration (Jan 19)

- [x] Add MuscleContributionEditor to exercises list page create modal
- [x] Add MuscleContributionEditor to template creation page create exercise modal
- [x] Add MuscleContributionEditor to exercise detail page edit modal
- [x] Active workout page already had MuscleContributionEditor
- [x] Apply default muscle contributions (70% primary, 30% split) to all exercises without custom contributions
- [x] Update analytics calculations to use default contributions as fallback
- [x] All exercises now have muscle contributions (custom or default 70/30)


## Fix Decimal Set Display (Jan 19)

- [x] Round decimal set values to 1 decimal place in analytics page charts
- [x] Exercise detail page doesn't display fractional sets (only actual whole number sets)
- [x] Fix floating point precision issues (e.g., 1.499999999999 → 1.5)


## Workout History Page and Default Rest Time (Jan 19)

### History Page
- [x] Create History page component in Profile tab
- [x] Display list of all completed workouts
- [x] Show day/date, template name (or "Quick Workout"), total sets, total volume per workout
- [x] Add workout detail modal that opens when clicking a workout
- [x] Modal shows full workout summary (exercises, sets, reps, weight, volume)
- [x] Modal matches the post-workout summary page design
- [x] Added icon mappings for clock.fill and timer icons

### Default Rest Time Setting
- [x] Add defaultRestTime field to gym context settings (default 90 seconds)
- [x] Add default rest time input to Profile page settings
- [x] Update template creation to use default rest time for new exercises
- [x] Update active workout to use default rest time for new exercises
- [x] Existing exercises in templates are not affected by default rest time changes


## Remove History from Bottom Navigation (Jan 19)

- [x] Remove History tab from bottom navigation bar (set href: null)
- [x] History is now only accessible from Profile page
- [x] Bottom nav only has: Home, Analytics, Profile


## Fix Profile Page Crash on Real Device (Jan 19)

- [x] Investigate Profile page crash when opening on real device
- [x] Identified the issue: settings.defaultRestTime was undefined during initial render
- [x] Fixed by adding safe fallback (settings.defaultRestTime || 90) in useState
- [x] Added useEffect to update input value once settings are loaded from AsyncStorage
- [ ] Test on real device to confirm fix (user to verify)


## Analytics and Exercise Details Improvements (Jan 19)

### Spider Chart Fixes
- [x] Save selected muscle groups to AsyncStorage for persistence
- [x] Load saved muscle groups when app reopens
- [x] Fix spider chart to connect dots with lines (increased stroke width and opacity)

### Volume Per Day Chart
- [x] Add new bar chart showing volume per day for current week
- [x] X-axis: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- [x] Y-axis: Actual volume (not weighted) in kg
- [x] Show total volume lifted each day
- [x] Added VolumePerDayChart component with proper styling

### Exercise Details Best Set Label
- [x] Add kg/lbs unit label to best set display
- [x] Format: "100 kg × 10 reps" instead of "100 × 10"
- [x] Make it clear which number is weight vs reps


## Fix SpiderChart Hooks Violation After Rollback (Jan 20)

- [x] Fix "rendered more hooks than during previous render" error in SpiderChart
- [x] Add missing React and useEffect imports
- [x] Move early return BEFORE all hooks (data.length < 3 check)
- [x] Ensure all hooks called unconditionally in same order

## Add Today Label to Home Page (Jan 20)

- [x] Add "Today" label above workout count and volume cards on home page


## Fix Analytics Error and Improve Charts (Jan 20)

- [x] Fix undefined totalSets error in analytics page muscle distribution section
- [x] Add conditional bar coloring to muscle distribution chart:
  - 0-9 sets → Yellow (#F59E0B)
  - 10-20 sets → Green (#22C55E)
  - Above 20 sets → Red (#EF4444)
- [x] Update all chart titles for consistent wording (added "Current Week" to titles)


## Fix Body Weight Tracking Issues (Jan 20)

- [x] Fix body weight entry logic - new entries should create new date entries, not overwrite yesterday's entry
- [x] Add manual body weight entry creation in history list
- [x] Add edit capability for existing body weight entries in history
- [x] Ensure body weight chart in analytics displays all entries from history correctly

## Revise Body Weight System (Jan 20 - Round 2)

- [x] Implement auto-creation of daily body weight entries on app launch
- [x] Add backfill logic to create entries for all missing days using most recent weight
- [x] Change save logic to update today's entry (find by date) instead of creating new entries
- [x] Update analytics chart filters to show fixed number of most recent entries (7 for week, 30 for month, etc.)
- [x] Ensure one entry per calendar day with no gaps in history list

## Add Default Initial Body Weight (Jan 20)

- [x] Create initial 70kg entry on first app launch if no body weight entries exist

## Fix Analytics Page Web Crash (Jan 20)

- [x] Add platform detection to prevent InteractiveLineChart from rendering on web
- [x] Implement web-compatible fallback for body weight chart
- [x] Test analytics page works on web without crashing

## Fix Analytics Page Mobile Crashes (Jan 20)

- [x] Investigate SpiderChart crash - "Expected static flag was missing" error
- [x] Investigate InteractiveLineChart crash - "Expected arraybuffer as first parameter" error
- [x] Fix chart data passing and Skia initialization issues
- [x] Remove QR code message from web fallback
- [x] Test analytics page works on mobile without crashing


## Implement Global Rest Timer System (Jan 20)

- [x] Add `timerEnabled` boolean field to TemplateExercise type in types.ts
- [x] Update storage.ts to persist timerEnabled field in templates
- [x] Create global timer state in gym-context.tsx with background notification support
- [x] Implement timer start/stop/adjust functions in gym-context
- [x] Create RestTimerPopup component with +15s/-15s/Skip buttons and progress bar
- [x] Add timer toggle icon to exercise cards in template create screen
- [x] Add timer toggle icon to exercise cards in template edit screen
- [x] Add timer toggle icon to exercise cards in active workout screen
- [x] Wire up auto-start timer logic when set is marked complete
- [x] Stop timer when workout is finished
- [x] Save timer enabled/disabled state back to template when updating from workout
- [x] Load timer enabled/disabled state from template when starting workout
- [x] Configure system notification sound for timer completion (uses default system sound, doesn't interrupt other apps)
- [x] Implement background timer with local notifications when app is minimized
- [x] All unit tests passing (16/16)


## Timer UI Adjustments (Jan 20)

- [x] Remove set number display from RestTimerPopup component (just show exercise name)
- [x] Add rest time display/edit input to exercise cards in active workout screen


## Timer UI Refinements (Jan 20)

- [x] Move rest timer input box to exercise card header (next to timer icon, remove label)
- [x] Add red strikethrough line to timer icon when disabled for clear visual indication


## Fix Timer Input and Icon Behavior (Jan 20)

- [x] Fix timer input to set value to 0 when cleared (not default 180)
- [x] Fix timer icon color to depend only on enabled/disabled state (not timer value)
- [x] Prevent timer popup from appearing when rest timer value is 0


## Change Muscle Distribution Chart Bar Length (Jan 20)

- [x] Change bar length calculation from volume to number of sets
- [x] Keep sorting from most to least sets
- [x] Keep existing row layout (sets + volume text, single line per row)


## Fix Muscle Distribution Chart Text Wrapping (Jan 20)

- [x] Increase stats text width to prevent "kg" unit from wrapping to new line


## Remove Start Workout Page (Jan 20)

- [x] Replace "Start Workout" button on home page with "Quick Workout" button
- [x] Quick Workout button directly opens empty workout session (no intermediate page)
- [x] Remove start workout page file (workout-selector.tsx)


## Fix Active Workout Page Title (Jan 20)

- [x] Show template name as page title when starting workout from template
- [x] Show "Quick Workout" as page title when starting from Quick Workout button


## Remove Template Save Prompts After Workout (Jan 20)

- [x] Remove "Update template?" prompt after finishing template workout (next page has Update Template button)
- [x] Remove "Save as template?" prompt after finishing quick workout (next page has Save as Template button)


## Add Finish Workout Confirmation (Jan 20)

- [x] Add confirmation dialog when tapping "Finish Workout" button
- [x] Dialog should ask "End the workout?" with Cancel and Confirm options
- [x] Only proceed to save and navigate after user confirms


## Fix Rest Timer Persisting Across Workouts (Jan 20)

- [x] Stop rest timer when user quits/exits active workout screen
- [x] Stop rest timer when user finishes workout
- [x] Ensure timer doesn't carry over to new workouts


## Fix Template Reload Without Clearing Template Data (Jan 20)

- [x] Fix blank workout when starting from same template twice
- [x] Ensure template data loads on every workout start
- [x] Do NOT clear or modify the actual template data
- [x] Use focus counter or key to force effect re-run

## Remove Workout Notes Field (Jan 20)

- [x] Remove notes input field from active workout page
- [x] Remove workoutNotes state and related code


## Verify Workout Page Title (Jan 20)

- [x] Ensure template name shows as page title when starting from template
- [x] Ensure "Quick Workout" shows as page title for quick workouts
- [x] Verify title is set correctly on screen focus


## Consolidate Settings to Profile Page (Jan 20)

- [x] Add Preferences card section to Profile page
- [x] Move Default Rest Time control to Preferences card
- [x] Move Weight Unit toggle to Preferences card
- [x] Remove Weight Unit section from Settings page


## Rename Settings to Data Management (Jan 20)

- [x] Update page title from "Settings" to "Data Management"
- [x] Update Profile page button label and description


## Update Muscle Groups to Match Body Map Library (Jan 20)

- [x] Analyze current muscle group implementation
- [x] Create migration plan for muscle group names (Option B: Full library support)
- [x] Update MuscleGroup type definition
- [x] Update muscle group constants/arrays
- [x] Create data migration script for existing exercises/templates/workouts
- [x] Update muscle group selectors in UI
- [x] Integrate migration into app initialization


## Fix Analytics Page Crash (Jan 21)

- [x] Fix "Cannot read property 'totalVolume' of undefined" error
- [x] Ensure muscle contribution calculation handles all muscle groups safely
- [x] Test analytics page with existing workout data


## Fix Remaining Lowercase Muscle Names (Jan 21)

- [x] Update analytics charts to use proper display names
- [x] Update muscle contribution editor to use proper display names
- [x] Verify all muscle names show capitalized throughout the app


## Add Muscle Distribution Chart Toggle (Jan 21)

- [x] Add toggle to switch between "All Muscles" and "Active Only" view
- [x] Show all muscle groups when "All Muscles" is selected
- [x] Show only muscles with volume > 0 when "Active Only" is selected
- [x] Default to "Active Only" view


## Add Muscle Map to Analytics Page (Jan 21)

- [x] Install react-native-body-highlighter library
- [x] Create muscle map component with time period selector (Today, 3 Days, 7 Days)
- [x] Calculate muscle intensity based on volume in selected period
- [x] Integrate muscle map into analytics page
- [x] Test muscle highlighting with workout data


## Show Front and Back Body Views Side by Side (Jan 21)

- [x] Update muscle map component to render both front and back body views
- [x] Arrange views horizontally side by side
- [x] Ensure both views show correct muscle highlighting


## Fix Backup Export and Ensure Complete Data Backup (Jan 21)

- [x] Fix export to save file to device Downloads folder (Android uses SAF, iOS uses share sheet)
- [x] Verify backup includes: templates, workouts, custom exercises, muscle contributions, PRs, body weight logs, settings
- [ ] Test export functionality on device
- [ ] Test import/restore functionality


## Fix Backup Restore Failure (CRITICAL - Jan 21)

- [x] Investigate why restore says "successful" but doesn't actually restore data
- [x] Check if data is being exported correctly in backup file
- [x] Check if import logic is actually saving the restored data
- [x] Add muscle group migration during import to convert old names to new format
- [x] Add proper error handling and logging to restore process
- [ ] Test full backup/restore cycle with real workout data (user to test)


## Add Restart Prompt After Restore (Jan 21)

- [x] Update restore success message to prompt user to restart app
- [x] Make it clear that changes won't take effect until restart


## Add Vibration When Rest Timer Reaches Zero (Jan 21)

- [x] Add 1-second vibration when rest timer completes
- [x] Use Vibration API for strong, noticeable alert
- [x] Ensure vibration works on both iOS and Android


## Add Week-Over-Week Muscle Volume Comparison Chart (Jan 21)

- [x] Calculate last week's volume per muscle (Monday-Sunday)
- [x] Calculate this week's volume per muscle (Monday-Sunday, current)
- [x] Separate volume into primary vs secondary muscle contributions
- [x] Create stacked bar chart component with:
  - Gray bars (last week): dark gray (primary) + light gray (secondary)
  - Red bars (this week, below last week): dark red (primary) + light red (secondary)
  - Green bars (this week, exceeded last week): dark green (primary) + light green (secondary)
- [x] Display muscle group labels at bottom
- [x] No volume numbers displayed on chart
- [x] Add chart to analytics page


## Week-Over-Week Chart Redesign (Jan 21)

- [x] Redesign week-over-week chart from vertical to horizontal layout
- [x] Display percentage change inline with bars
- [x] Display volume amounts inline with bars
- [x] Make chart style consistent with muscle distribution chart
- [x] Reorder charts: week-over-week first, then muscle distribution below it


## Fix Week-Over-Week Volume Calculation (Jan 21)

- [x] Update week-over-week chart to use muscle contribution percentages
- [x] Match calculation logic with muscle distribution chart
- [x] Ensure volume numbers are consistent across both charts


## Fix Week-Over-Week Volume Calculation (Jan 21)

- [x] Update week-over-week chart to use muscle contribution percentages
- [x] Match calculation logic with muscle distribution chart
- [x] Ensure volume numbers are consistent across both charts


## Add 'Save as New Template' Button (Jan 21)

- [x] Add 'Save as New Template' button to workout complete page
- [x] Create dialog/modal for entering new template name
- [x] Implement logic to save completed workout as new template
- [x] Ensure original template remains unchanged
- [x] Test that new template appears in templates list


## Week-Over-Week Chart Overlay Redesign (Jan 21)

- [x] Overlay red/green bar on top of gray bar (gray as background, colored as fill)
- [x] Combine percentage and volume onto one line per muscle
- [x] Reduce each muscle from two rows to one row
- [x] Maintain visual clarity of comparison (above/below last week)


## Combine Charts into Unified Togglable Component (Jan 21)

- [x] Create unified chart component with dropdown selector
- [x] Add two chart modes: "Week-Over-Week Volume" and "Current Week Sets"
- [x] Share "Active Only / All Muscles" toggle between both modes
- [x] Make bar heights consistent between both chart modes
- [x] Remove volume stats from "Current Week Sets" mode
- [x] Keep percentage & volume stats in "Week-Over-Week Volume" mode
- [x] Replace two separate charts on analytics page with one unified chart


## Fix Current Week Sets Mode Display (Jan 21)

- [ ] Add set count display on each row (e.g., "12.5 sets")
- [ ] Color-code bars based on set count: yellow (1-9), green (10-20), red (20+)
- [ ] Match formatting style of Week-Over-Week mode stats


## Fix Unified Chart Display (Jan 21)

- [x] Current Week Sets: Add set count display on each row (e.g., "12.5 sets")
- [x] Current Week Sets: Color-code bars (yellow 1-9, green 10-20, red 20+)
- [x] Week-Over-Week: Limit percentage to 1 decimal place
- [x] Week-Over-Week: Limit volume to 1 decimal place


## Remove Exercise Name from Timer Area (Jan 21)

- [x] Find timer component on active workout screen
- [x] Remove exercise name display from timer area
- [x] Reduce vertical space taken by timer area


## Fix Exercise Replacement Type Bug (Jan 21)

- [ ] When replacing weighted-bodyweight exercise with bodyweight exercise, update exercise type
- [ ] Ensure weight input is removed when switching to bodyweight exercise
- [ ] Ensure weight input is added when switching to weighted exercise
- [ ] Test replacement between all exercise types (weighted, bodyweight, assisted-bodyweight, weighted-bodyweight)


## Fix Exercise Replacement Type Bug (Jan 21)

- [x] When replacing exercise, update exercise type based on new exercise
- [x] Bodyweight → only reps input (no weight)
- [x] Weighted/Assisted-BW/Weighted-BW → weight + reps inputs with correct logic
- [x] Make weight optional in CompletedSet interface
- [x] Update all sets when replacing exercise to match new type


## Add Volume Displays to Exercise Cards and Workout Header (Jan 21)

- [x] Template exercise cards: Show total volume (weight × reps × sets) in title row
- [x] Active workout exercise cards: Show volume of completed (checked) sets only in title row
- [x] Active workout: Update volume in real-time when sets are checked/unchecked or values change
- [x] Active workout header: Show total session volume next to workout title
- [x] Format volume with weight unit (e.g., "1500 kg")


## Fix Volume Not Updating After Exercise Replacement (Jan 21)

- [x] When exercise is replaced, volume display should update based on new exercise weights
- [x] Completed sets should remain checked but use new weight values for volume calculation
- [x] Fix: Bodyweight exercises should use stored bodyweight value, NOT 0
- [x] Volume calculation: bodyweight exercises use set.weight (which stores bodyweight)
- [x] When replacing with bodyweight exercise, fetch and store current bodyweight
- [x] Ensure state update triggers re-render of volume displays


## Fix Volume Calculation Formulas for All Exercise Types (Jan 21)

- [ ] Weighted: volume = weight × reps
- [ ] Bodyweight: volume = bodyweight × reps
- [ ] Assisted-bodyweight: volume = (bodyweight - weight) × reps
- [ ] Weighted-bodyweight: volume = (bodyweight + weight) × reps
- [ ] Create helper function that takes exercise type, set, and bodyweight
- [ ] Update exercise card volume display to use correct formula
- [ ] Update total session volume display to use correct formula
- [ ] Fetch current bodyweight when calculating volume for BW exercises


## Fix Volume Calculation Formulas for All Exercise Types (Jan 21)

- [x] Weighted: weight × reps
- [x] Bodyweight: bodyweight × reps
- [x] Assisted-bodyweight: (bodyweight - assistance_weight) × reps
- [x] Weighted-bodyweight: (bodyweight + added_weight) × reps
- [x] Create centralized calculateSetVolume function in lib/volume-calculator.ts
- [x] Update active workout screen volume calculations
- [x] Update template creation screen volume calculations
- [x] Update analytics charts volume calculations (muscle distribution, volume per day)
- [ ] Update home page volume calculation
- [ ] Update history page volume calculation
- [ ] Update workout summary volume calculation
- [ ] Update workout detail modal volume calculation
- [ ] Update workout muscle map volume calculation
- [ ] Update PR detection volume calculations
- [ ] Update unified muscle chart component volume calculations


## Template Export/Import Feature (Jan 21)

- [x] Create template export function that generates JSON file
- [x] Include template data (name, exercises, sets, reps, weights, rest times)
- [x] Include custom exercise definitions used in template
- [x] Save exported file to Downloads folder with naming: Template-Name-Date.json
- [x] Add export icon button to each template card on home page
- [x] Create template import function with JSON validation
- [x] Validate file structure and required fields
- [x] Check template has at least 1 exercise
- [x] Auto-rename duplicate template names (e.g., "Push Day" → "Push Day (2)")
- [x] Auto-rename conflicting custom exercises (e.g., "Pullup" → "Pullup (Imported)")
- [x] Import custom exercises that don't exist in user's data
- [x] Navigate to template edit page on successful import
- [x] Add security warning dialog before import
- [x] Add "Import" button next to "New" on home page template section
- [x] Show success/error toasts for user feedback


## Fix Template Export/Import UX and Bodyweight Exercise Bug (Jan 21)

- [x] Change export icon from share to proper export/download icon
- [x] Change import icon to proper import/upload icon
- [x] Add confirmation dialog before export ("Are you sure you want to export this template?")
- [x] Add file picker for export location selection (let user choose where to save)
- [x] Fix bug: Bodyweight exercises created on template page show weight input when they shouldn't
- [x] Add security warning to Import Data button in settings page


## Swap Import and Export Icons (Jan 21)

- [x] Swap export icon to upload icon (arrow pointing up - file going away)
- [x] Swap import icon to download icon (arrow pointing down - file coming in)


## Fix Template Import Exercise Logic (Jan 21)

- [x] Change import logic to use existing exercises by name only (ignore definition differences)
- [x] Only import exercises that don't exist in user's exercise list
- [x] Remove "(Imported)" renaming logic for conflicting definitions


## Refactor Exercise Creation into Single Reusable Component (Jan 21)

- [ ] Create shared CreateExerciseModal component in components folder
- [ ] Optimize layout: name, exercise type, primary muscle, secondary muscles, muscle contributions
- [ ] Add props: visible, onClose, onExerciseCreated, autoAddToContext (workout/template)
- [ ] Replace inline exercise creation modal in active-workout.tsx
- [ ] Replace inline exercise creation modal in templates/create.tsx
- [ ] Replace exercise creation modal in exercises.tsx
- [ ] Test exercise creation from all three contexts
- [ ] Verify exercise is added to workout/template when appropriate


## Refactor Exercise Creation/Editing into Single Reusable Component (Jan 21)

- [x] Create shared CreateExerciseModal component in components folder
- [x] Support both 'create' and 'edit' modes with appropriate titles and button text
- [x] Optimize layout: name, exercise type, primary muscle, secondary muscles, muscle contributions
- [x] Replace inline creation modal in active-workout.tsx
- [x] Replace inline creation modal in templates/create.tsx
- [x] Replace creation modal in exercises.tsx
- [x] Replace edit modal in exercises/[exerciseName].tsx
- [x] Test creation from all three contexts (workout, template, exercises page)
- [x] Test editing from exercise detail page


## Add Total Volume to Template Header (Jan 21)

- [x] Calculate total volume across all exercises in template
- [x] Display total volume next to "Create Template" or "Edit Template" title in header
- [x] Use existing calculateExerciseVolume function for each exercise
- [x] Sum all exercise volumes for template total


## Persistent Workout Session System (Jan 21)

- [x] Add isWorkoutActive, activeWorkoutName, activeWorkoutStartTime to gym context
- [x] Add setWorkoutActive and clearWorkoutActive functions to gym context
- [x] Create ActiveWorkoutBanner component (shows workout name, elapsed time, Continue/End buttons)
- [x] Add banner to root layout (_layout.tsx) - displays when workout is active
- [x] Add workout active check to "Quick Workout" button on home page
- [x] Add workout active check to template start buttons
- [x] Show alert "You have an active workout. End it first?" when trying to start new workout
- [x] Update active-workout page to call setWorkoutActive on mount
- [x] Update active-workout page to call clearWorkoutActive on finish/discard
- [x] Android back button allows navigation away (no confirmation)
- [x] Red X button shows "End workout?" confirmation dialog
- [x] Banner "Continue" button navigates to active-workout page
- [x] Banner "End" button shows "End workout?" confirmation dialog
- [x] Add bottom padding to all pages when workout is active to prevent banner from covering content


## Fix Persistent Workout Banner Bugs (Jan 21)

- [x] Hide banner when on active-workout page (redundant to show it there)
- [x] Fix tab bar sizing issue caused by incorrect padding application
- [x] Store templateId and templateName in workout active state
- [x] Navigate to correct workout (template vs quick) when clicking Continue
- [x] Sync banner timer with actual workout elapsed time instead of calculating from start time


## Fix Banner Visibility and End Button Behavior (Jan 21)

- [x] Debug why banner still shows on active workout page (should be hidden)
- [x] Make banner "End" button call handleQuitWorkout (same as red X)
- [x] Ensure End button shows same confirmation dialog as Quit
- [x] Ensure End button discards workout immediately (no summary screen)


## Remove Extra Padding on Active Workout Page (Jan 21)

- [x] Fix tabs layout to not apply bottom padding when on active workout page
- [x] Padding should only apply when banner is visible (not on workout page)


## Fix Frozen Timers (Jan 21)

- [x] Debug why workout page timer is stuck at 0
- [x] Debug why banner timer is stuck at 0
- [x] Fix timer initialization when workout starts
- [x] Fix timer update synchronization between local and global state


## Simplify Timer System (Jan 21)

- [x] Remove activeWorkoutElapsedTime from global state (not needed)
- [x] Remove updateWorkoutElapsedTime function from global context
- [x] Update banner to calculate elapsed time from activeWorkoutStartTime
- [x] Update workout page to use startTime directly instead of syncing elapsed time
- [x] Both displays calculate: Math.floor((Date.now() - startTime) / 1000)


## CRITICAL: Fix Timer and Data Persistence Bugs (Jan 21)

- [ ] Debug why workout page timer stays at 0 (not counting)
- [ ] Debug why banner timer stays at 0 (not counting)
- [ ] Fix workout data persistence - exercises and completed sets lost when navigating away
- [ ] Store active workout state (exercises, sets, bodyweight) in global context
- [ ] Restore workout state when returning to active workout page

## Bug Fix - Workout Complete Page Volume

- [x] Fix incorrect total volume calculation on workout complete page to use centralized volume calculator

## Bug Fix - Custom Bodyweight Exercises in Templates

- [x] Fix custom bodyweight exercises in template workouts to show only reps input (not weight)
- [x] Fix volume calculation for custom bodyweight exercises in templates to use bodyweight × reps
- [x] Ensure exercise type metadata is properly loaded when adding existing custom exercises to templates
- [x] Debug why newly created custom BW exercises show weight input in all contexts (templates and workouts)
- [x] Add type alias field to all custom exercise creation paths (exercises page, template page, workout page)
- [x] Add defensive type lookup when loading template exercises to handle stale data
- [x] **ROOT CAUSE FIX**: Change predefinedEx?.type to predefinedEx?.exerciseType in template creation (lines 222, 518)

## Bug Fix - Replace Exercise Type Handling

- [x] Fix replace exercise to update UI when switching between weighted and bodyweight exercises
- [x] Ensure sets are properly updated to match new exercise type after replacement
- [x] Added custom exercise lookup in handleReplaceExercise (active-workout.tsx line 409-411)

## Bug Fix - Template Page State Reset

- [x] Fix template creation page to reset state when closed/navigated away
- [x] Ensure clean state when creating new template after editing existing one
- [x] Added else clause to reset templateName and exercises when templateId is undefined (templates/create.tsx lines 149-153)

## Bug Fix - New BW Exercise in Template

- [x] Debug why newly created BW exercises in templates show weight input instead of reps only
- [x] Fixed template page to use exercise's stored type field directly instead of looking up (templates/create.tsx line 785)

## Bug Fix - Android UI Layout Issues

- [x] Fix active workout banner buttons obscured by Android system nav bar (added useSafeAreaInsets to banner)
- [x] Reduce excessive padding in in-app tab bar on Android (reduced base padding and tab bar height)

## UI Improvement - Remove Timer from Banner

- [x] Remove elapsed time display from active workout banner (keep only workout name and buttons)

## Bug Fix - Exercise Menu Positioning

- [x] Fix exercise edit menu (replace/remove) appearing halfway off screen during workout (aligned to right edge with padding)

## UI Improvement - Template Timer Disabled Styling

- [x] Add red strike-through to disabled rest timers on template page (match workout page styling)

## Bug Fix - Workout Timer Not Working

- [x] Fix workout timer at top of active workout page not updating (initialize timer immediately on mount)

## Bug Fix - Persistent Workout Banner Not Showing

- [x] Investigate why ActiveWorkoutBanner doesn't appear when navigating from workout page (state not persisted)
- [x] Check if workout state is being properly tracked in context (was only in memory)
- [x] Fix banner visibility logic or conditional rendering (added AsyncStorage persistence)
- [x] Ensure banner shows on all screens except active workout page (restored state on app init)

## Bug Fix - Template Unsaved Changes Warning Not Showing

- [x] Investigate why beforeRemove navigation listener isn't triggering (incompatible with expo-router)
- [x] Check if hasUnsavedChanges state is being set correctly (state was fine)
- [x] Verify navigation.addListener is working with expo-router (not compatible)
- [x] Fix or replace navigation warning implementation (replaced with usePreventRemove hook)

## Navigation Warning Fix

- [x] Fix usePreventRemove callback to set hasUnsavedChanges to false before calling router.back()
- [x] Use setTimeout to ensure state update completes before navigation
- [x] Test that X button and back navigation both show warning dialog
- [x] Verify that "Discard" button properly navigates away without loop

## Stack Navigator Fix for usePreventRemove

- [x] Create app/(tabs)/templates/_layout.tsx with Stack navigator
- [x] Move app/(tabs)/templates.tsx to app/(tabs)/templates/index.tsx
- [x] Update tabs _layout.tsx to properly reference templates folder
- [x] Verify usePreventRemove works correctly with Stack navigator context
- [x] Test that navigation warning appears when leaving template creation page

## Template Save Bug Fix - Type Mismatch

- [x] Create completedExercisesToTemplateExercises converter function in workout-summary.tsx
- [x] Map CompletedExercise.sets (CompletedSet[]) to Exercise.setDetails (TemplateSetConfig[])
- [x] Map sets.length to Exercise.sets (number)
- [x] Use last set for default reps/weight values
- [x] Infer exercise type and muscle groups from exercise name
- [x] Update handleSaveAsTemplate to use converter instead of 'as any'
- [x] Update handleUpdateTemplate to use converter instead of 'as any'
- [x] Test that saved templates show all set details correctly

## Active Workout Banner Bug Fix - isWorkoutActive Source of Truth

- [x] Add isWorkoutActive to useGym destructuring in ActiveWorkoutScreen
- [x] Update focus listener to reset only when !isWorkoutActive (not based on activeWorkoutExercises)
- [x] Update workout initialization to check !isWorkoutActive (not !activeWorkoutStartTime)
- [x] Add restore logic when isWorkoutActive is true to sync local state
- [x] Update exercise restore condition to check isWorkoutActive first
- [x] Test that banner appears correctly for second and subsequent workouts

## Banner Always Visible Bug Fix - clearWorkoutActive Not Called

- [x] Check banner End button handler - ensure it calls clearWorkoutActive()
- [x] Verify Active Workout X button quit handler calls clearWorkoutActive()
- [x] Verify handleFinishWorkout calls clearWorkoutActive() after saving workout
- [x] Check ActiveWorkoutStorage.clear() implementation - must remove stored state
- [x] Make clearWorkoutActive async and await storage clear to prevent race conditions
- [x] Update all call sites to await clearWorkoutActive()
- [x] Test that banner disappears after ending/quitting workout

## Banner Reappearing Bug Fix - ActiveWorkoutScreen Re-activating Cleared Workouts

- [x] Investigate ActiveWorkoutScreen initialization effect that calls setWorkoutActive
- [x] Add hasInitializedWorkout ref to track if workout was initialized on this mount
- [x] Fix initialization to only call setWorkoutActive once on first mount
- [x] Ensure cleared workouts don't get re-activated when effect re-runs
- [x] Test that banner stays hidden after ending/quitting workout

## Banner Reappearing Bug - Deep Investigation

- [ ] Trace focus listener effect - does it reset state incorrectly?
- [ ] Check if router.back() or router.push() causes component remount
- [ ] Investigate exercise restore effect - does it call setWorkoutActive?
- [ ] Check ActiveWorkoutExerciseStorage - does it persist data after clear?
- [ ] Trace all paths that call setWorkoutActive() in the codebase
- [ ] Document the exact sequence of events causing banner to reappear

## Template Edit Modal Improvements

- [x] Add "Save as New Template" button next to "Update Template" button
- [x] Implement save as new template functionality (generates new ID, adds to templates)
- [x] Add bottom safe area padding to template edit modal for Android nav bar
- [x] Test that both buttons work correctly (update vs save new)

## Save as New Template Fixes

- [x] Add name prompt dialog before saving new template (pre-fill with "Copy of [name]")
- [x] Fix set data preservation - ensure setDetails are saved with all reps/weight/unit values
- [x] Test that duplicated template includes all exercise configurations

## Save as New Template - Cross-Platform Fix

- [x] Replace Alert.prompt (iOS-only) with custom text input modal
- [x] Create modal with TextInput, Cancel, and Save buttons
- [x] Test on Android and web platforms

## Template Card Drag Smoothness Fix

- [x] Investigate DraggableFlatList implementation on home page
- [x] Add activateAfterLongPress(200ms) to require long press before drag
- [x] Adjust spring animation parameters (damping: 20, stiffness: 200)
- [x] Reduce haptic feedback from Medium to Light
- [x] Test drag smoothness and responsiveness

## Template Card Reordering - Arrow Buttons

- [x] Create simple TemplateCard component without drag gestures
- [x] Add up/down arrow buttons (chevron.up/chevron.down icons)
- [x] Implement onMoveUp and onMoveDown callbacks
- [x] Update home page to handle arrow button reordering
- [x] Remove old DraggableTemplateCard component
- [x] Make component reusable for other card lists

## Exercise Card Reordering - Arrow Buttons in Template Create/Edit

- [x] Replace DraggableFlatList with regular FlatList in template create screen
- [x] Add up/down arrow buttons to exercise cards (replacing drag handle)
- [x] Implement handleMoveExerciseUp and handleMoveExerciseDown functions
- [x] Remove drag handle and drag-related code from exercise cards
- [x] Test reordering exercises in template creation/editing

## Active Workout Exercise Reordering - Arrow Buttons

- [x] Add up/down arrow buttons to active workout exercise cards
- [x] Implement handleMoveExerciseUp and handleMoveExerciseDown for active workout
- [x] Update exercise card rendering to show arrows
- [x] Test reordering exercises during active workout

## Template Save All Sets Fix

- [x] Remove .filter((set) => set.completed) from handleFinishWorkout to save all sets
- [x] Include uncompleted sets in workout save (user added but didn't finish)
- [x] Include new exercises even if no sets were completed
- [x] Preserve new weights, reps, and set counts from workout
- [x] Test that template captures full workout structure regardless of completion status

## Exercise Card Edit Menu Positioning Fix

- [x] Find the edit menu in template create/edit screen
- [x] Adjust menu positioning to anchor to right edge instead of left
- [x] Add maxWidth constraint based on screen dimensions
- [x] Test menu positioning on different devices

## Bodyweight Exercise Special Handling

- [x] In template create/edit: Hide weight input for bodyweight exercises, show only reps with +/- buttons
- [x] In template create/edit: Auto-fill weight with user's current bodyweight from BodyWeightStorage
- [x] In active workout: Hide weight input for bodyweight exercises, show only reps with +/- buttons
- [x] In active workout: Auto-fill weight with user's current bodyweight from BodyWeightStorage
- [x] Ensure bodyweight is retrieved from BodyWeightStorage.getTodayWeight()
- [x] Verified implementation already exists in both contexts

## Custom Bodyweight Exercise Bug

- [x] Investigate why custom bodyweight exercises don't hide weight input
- [x] Check if exercise type is being saved when creating custom exercises (it was)
- [x] Found that getExerciseMuscles() only checks predefined exercises, not custom
- [x] Fixed handleAddSet in template create to use exercise.type directly
- [x] Fixed handleAddSet in active workout to use exercise.type directly
- [x] Test that custom bodyweight exercises work like predefined ones

## Custom Bodyweight Exercise Inconsistency

- [x] Check how exercises are added from exercise picker (not inline creation)
- [x] Verify exercise type is preserved when selecting from picker
- [x] Found template create screen was correct (checks custom first)
- [x] Fixed handleAddExerciseToWorkout in active workout to check custom exercises first
- [x] Added bodyweight detection and auto-fill logic to active workout picker path
- [x] Test that custom bodyweight exercises work consistently across all creation paths

## Exercise Creation Type Saving Issue

- [x] Check create-exercise screen (profile → exercises → new) - saves both type and exerciseType
- [x] Check if exercise type is properly saved to CustomExerciseStorage - yes, correctly saved
- [x] Check inline exercise creation in template page (handleCreateExercise) - saves type correctly
- [x] Check inline exercise creation in active workout page - saves type correctly
- [x] Fixed template inline creation to initialize bodyweight with user's bodyweight
- [x] Fixed active workout inline creation to initialize bodyweight with user's bodyweight
- [x] Test that newly created bodyweight exercises work immediately after creation

## Live Exercise References in Templates

- [x] Refactor templates to store exercise references (id/name) instead of full exercise data snapshots
- [x] Update template rendering to resolve exercise data at runtime from CustomExerciseStorage
- [x] Handle deleted custom exercises gracefully (show placeholder or remove from template)
- [x] Test that editing custom exercise name/muscles/type updates all templates using it

## Bug Fixes

- [x] Fix muscle contribution changes not persisting when editing exercises (values reset to default after save)

## UI Enhancements

- [x] Add "Best set" display to exercise cards in active workouts (show weight x reps below PR/1RM)
- [x] Add "Best set" display to exercise cards in template creation/edit modals

## Critical Bugs

- [x] Fix unchecked sets being counted as completed when finishing workout (affects volume, PRs, and workout summary)
- [x] Fix "Update Template" only updating exercises with completed sets (should update ALL exercises with ALL sets, preserving completion status)
- [x] Fix muscle contribution changes not persisting in Profile > Exercise section (values reset after save)
- [x] Fix back button on exercise details page not returning to exercise list
- [x] Fix volume calculations broken for bodyweight/weighted-bw/assisted exercises (must use exercise type to calculate correctly)
- [x] Fix bodyweight fetching to use most recently entered value instead of defaulting to 70kg in volume calculations

## New Features

- [x] Add daily quote card to homepage displaying random philosophical quotes about strength training
- [x] Rename app to "Offline Gym Tracker" and generate new icon matching app color scheme
- [x] Fix current week sets bar chart to display set counts instead of volume
- [x] Move daily quote to top of homepage under the date
- [x] Fix muscles worked chart showing false data when no workouts were done today
- [x] Add 23 new philosophical quotes to the quote card
- [x] Fix muscles worked chart showing data when no workouts were done today (date filtering issue)
- [x] Fix workout duration timer stuck at zero on active workout page

## Exercise Volume Tracking

- [x] Create exercise volume storage module for tracking highest daily set volume per exercise
- [x] Replace rep/weight progression chart with volume progression chart on exercise details page
- [x] Add History button to exercise details page that opens volume history modal
- [x] Create volume history modal (matching bodyweight history modal style) with add/edit/delete functionality
- [x] Hook volume tracking into workout completion to auto-generate entries (overwrite only if new volume is higher)
- [x] Ensure only one volume entry per day per exercise

## Chart Improvements

- [x] Update InteractiveLineChart to show Y-axis grid lines at integer values only
- [x] Implement dynamic Y-axis scaling that adjusts intelligently as data range changes
- [x] Rotate X-axis date labels vertically for better readability

## Bug Fixes

- [x] Fix volume history not refreshing on exercise details page after workout completion (data saves correctly but UI doesn't reload)

## Chart Visual Improvements

- [x] Make grid lines much lighter and less prominent (reduce opacity and stroke width)
- [x] Fix X-axis labels to be horizontal instead of vertical (critical - violates professional standards)
- [x] Improve data point visibility (larger circles, better contrast)
- [x] Add better spacing and padding around chart elements
- [x] Polish typography (font sizes, weights, alignment)
- [x] Add subtle visual depth (optional shadows, background differentiation)

## Chart Scaling Improvements

- [x] Add minimum Y-axis interval of 0.5 (not just integers) for better granularity with small data ranges
- [x] Add padding to Y-axis range so highest and lowest data points don't touch chart edges

## Bug: Volume Data Not Tracking

- [ ] Investigate why some workout data is not being added to exercise volume progression charts
<<<<<<< Updated upstream
- [ ] Fix the identified issue in volume tracking logic (deferred - user requested different feature)

## Template Card Menu

- [x] Replace delete and export icons with single settings/menu icon on template cards
- [x] Create popup menu component matching workout exercise card edit menu behavior
- [x] Add Export, Duplicate, and Delete options to menu
- [x] Ensure menu respects screen boundaries
- [x] Implement duplicate template functionality (appends " (Copy)" to name)

## Rep Max Estimate Table

- [x] Create rep max calculation utility function with personalized fatigue constant
- [x] Add 2-column table to exercise details page showing estimated weights for 1, 5, 10, 15, 20, 25 reps
- [x] Handle edge cases (missing 1RM or best set, invalid calculations)
- [x] Ensure values are capped at 1RM and strictly decreasing
- [x] Round all weights to integers

## Rep Max Table Improvements

- [x] Fix 1RM bug - display actual 1RM from top of page, not recalculated value
- [x] Compact table styling - reduce padding between rows
- [x] Left-align both columns in table
- [x] Add manual override capability - let users tap any row to manually set that rep max value
- [x] Recalculate fatigue constant and update other estimates when user overrides a value

## Mock Data Generation

- [x] Analyze existing backup file structure
- [x] Generate several months of realistic workout data with progression
- [x] Create mock data file for testing

## Bug: Volume Progression Data Not Restored on Import

- [x] Investigate export logic to check if volume data is included in export file
- [x] Investigate import logic to check if volume data is being restored
- [x] Fix the issue so volume progression data is properly exported and imported

## Exercise Details Page Volume Chart Enhancements

- [x] Create rolling average calculation utility function
- [x] Update InteractiveLineChart component to support multiple data series (for rolling average overlay)
- [x] Add dropdown selector to switch between "Best Set Per Day" and "Total Volume Per Week" views
- [x] Implement total volume per week calculation logic
- [x] Add rolling average line to both volume chart views

## Analytics Page Bodyweight Chart Enhancement

- [x] Add rolling average line to bodyweight chart
=======
- [ ] Fix the identified issue in volume tracking logic
>>>>>>> Stashed changes

## Bug: Volume Discrepancy Between Home Page and Analytics Page

- [x] Investigate home page "total volume today" calculation logic
- [x] Investigate analytics page "volume per day" chart calculation logic
- [x] Identify why the two values differ (analytics counts incomplete sets, home page doesn't)
- [x] Fix analytics page to only count completed sets
- [x] Consolidate volume calculation functions to use single source

## Male/Female Body Map Selector

- [x] Add bodyMapGender preference to gym context and settings
- [x] Create male/female selector UI in profile preferences
- [x] Integrate female map into workout-muscle-map component
- [ ] Test male/female map switching functionality

## APK Build Failure Fix

- [x] Diagnose app:createBundleReleaseJsAndAssets failure
- [x] Fix duplicate imports in workout-muscle-map.tsx
- [x] Fix TypeScript errors preventing bundling
- [x] Relax TypeScript strictness for non-critical errors
- [ ] Verify APK build succeeds

## Weekly Stats Card Optimization

- [x] Condense weekly stats card rows to single line layout
- [x] Update "Favorite Exercise" label to "Favorite"
- [ ] Test optimized layout for better vertical space usage

## Recent Changes
- [x] Rename app to "Swole Revolution"
- [x] Update app slug to "swole-revolution" for APK installer
- [x] Resize dumbbell logo to be smaller
- [x] Fix workout state management bug: title flickering between old and new workout after ending previous workout
- [x] Remove table view from estimated 1RM card on exercise details page (keep only graph)
- [x] Improve rep max calculation: use top 3-5 sets with recency weighting instead of single best set
