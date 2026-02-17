# Set Structure Comparison: Templates vs Active Workouts

## Overview
Both templates and active workouts use the **same `CompletedSet` interface**, but they handle the optional `completed` flag differently based on their use case.

---

## Interface Definitions

### `CompletedSet` Interface (lib/types.ts, Lines 79-88)
```typescript
export interface CompletedSet {
  setNumber: number;
  reps: number;
  weight: number; // For bodyweight exercises, set to 0
  unit: WeightUnit;
  timestamp: number;
  completed?: boolean; // Whether this set was marked as complete
  isRepsPlaceholder?: boolean; // Whether reps value is a placeholder (not user-entered)
  isWeightPlaceholder?: boolean; // Whether weight value is a placeholder (not user-entered)
}
```

### `Exercise` Interface (Template) (lib/types.ts, Lines 54-70)
```typescript
export interface Exercise {
  id: string;
  name: string;
  sets: number; // Total number of sets (for backward compatibility)
  reps: number; // Default reps (for backward compatibility)
  weight?: number; // Default weight (for backward compatibility)
  unit: WeightUnit;
  type: ExerciseType;
  notes?: string;
  restTimer?: number; // Rest time in seconds, default 180 (3 mins)
  timerEnabled?: boolean; // Whether rest timer is enabled for this exercise (default true)
  primaryMuscle?: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  setDetails?: TemplateSetConfig[]; // Individual set configurations (reps/weight per set)
}
```

### `TemplateSetConfig` Interface (lib/types.ts, Lines 48-52)
```typescript
export interface TemplateSetConfig {
  reps: number;
  weight: number;
  unit: WeightUnit;
}
```

---

## 1. Template Sets Structure (templates/create.tsx)

### How Sets are Created
**File**: [app/_hidden/templates/create.tsx](app/_hidden/templates/create.tsx#L119-L137)

```typescript
const completedSets: CompletedSet[] = ex.setDetails && ex.setDetails.length > 0
  ? ex.setDetails.map((setConfig, i) => ({
      setNumber: i + 1,
      reps: setConfig.reps,
      weight: setConfig.weight,
      unit: setConfig.unit,
      timestamp: Date.now(),
      completed: false,  // ← Always initialized to false
    }))
  : Array.from({ length: ex.sets }, (_, i) => ({
      setNumber: i + 1,
      reps: ex.reps,
      weight: ex.weight || 0,
      unit: ex.unit,
      timestamp: Date.now(),
      completed: false,  // ← Always initialized to false
    }));
```

### How Sets are Saved
**File**: [app/_hidden/templates/create.tsx](app/_hidden/templates/create.tsx#L549-L554)

```typescript
// Convert CompletedSet[] to TemplateSetConfig[]
const setDetails = ex.sets.map(set => ({
  reps: set.reps,
  weight: set.weight,
  unit: set.unit,
  // NOTE: 'completed' flag is STRIPPED OUT
}));
```

### Key Characteristics:
- ✅ Uses `CompletedSet[]` as working structure
- ✅ `completed` flag is **initialized to `false`** but **NEVER used**
- ✅ When saving to template storage, `completed` is **stripped away**
- ✅ Only stores `reps`, `weight`, and `unit` in `TemplateSetConfig`
- ℹ️ Templates represent planned/configured sets, not executed sets

---

## 2. Active Workout Sets Structure (active-workout.tsx)

### How Sets are Created
**File**: [app/_hidden/active-workout.tsx](app/_hidden/active-workout.tsx#L189-L213)

```typescript
// Strategy 1: Use setDetails if available and non-empty
if (ex.setDetails && Array.isArray(ex.setDetails) && ex.setDetails.length > 0) {
  completedSets = ex.setDetails.map((setConfig, i) => ({
    setNumber: i + 1,
    reps: setConfig.reps || 0,
    weight: setConfig.weight || 0,
    unit: setConfig.unit || 'kg',
    timestamp: Date.now(),
    completed: false,
  }));
}
// Strategy 2: Fall back to sets count with default values
else if (ex.sets && ex.sets > 0) {
  completedSets = Array.from({ length: ex.sets }, (_, i) => ({
    setNumber: i + 1,
    reps: ex.reps || 0,
    weight: ex.weight || 0,
    unit: ex.unit || 'kg',
    timestamp: Date.now(),
    completed: false,
  }));
}
```

### How Sets are Tracked During Workout
**File**: [app/_hidden/active-workout.tsx](app/_hidden/active-workout.tsx#L610-L620)

```typescript
const handleToggleSetComplete = useCallback((exerciseIndex: number, setIndex: number) => {
  const exercise = exercises[exerciseIndex];
  const isCompleting = !exercise.completedSets[setIndex].completed;
  
  setExercises((prev) => {
    const updated = [...prev];
    updated[exerciseIndex].completedSets[setIndex].completed =
      !updated[exerciseIndex].completedSets[setIndex].completed;
    return updated;
  });
  // ... timer logic
}, [exercises, disabledTimers, ...]);
```

### How Sets are Saved to Workout
**File**: [app/_hidden/active-workout.tsx](app/_hidden/active-workout.tsx#L942-L963)

```typescript
sets: ex.completedSets
  // Save ALL sets (completed and uncompleted) for template updates
  // The 'completed' flag indicates which sets were actually done
  .map((set) => ({
    ...set,
    // For bodyweight exercises, use current body weight
    // For assisted bodyweight, use (body weight - assistance weight)
    // For weighted bodyweight, use (body weight + added weight)
    weight: isBodyweight 
      ? bodyWeightKg 
      : isAssistedBodyweight 
        ? Math.max(0, bodyWeightKg - set.weight)
      : isWeightedBodyweight
        ? bodyWeightKg + set.weight
        : set.weight,
  })),
```

### Key Characteristics:
- ✅ Uses `CompletedSet[]` as working structure
- ✅ `completed` flag is **actively used and toggled**
- ✅ Filters completed sets: `exercise.completedSets.filter(s => s.completed)`
- ✅ **ALL sets** are saved to the workout (both completed and uncompleted)
- ✅ The `completed` flag is preserved in the saved workout data
- ℹ️ Workouts track which sets were actually performed vs. skipped

### Usage Examples:
```typescript
// Count completed sets (line 624)
const completedCount = exercise.completedSets.filter(s => s.completed).length + 1;

// Check if workout has any completed sets (line 911)
const hasCompletedSets = exercises.some((ex) => 
  ex.completedSets.some((set) => set.completed)
);

// Visual styling based on completion (line 1091-1092)
backgroundColor: set.completed ? colors.success : colors.surface,
borderColor: set.completed ? colors.success : colors.border,

// Checkmark icon (line 1097)
{set.completed && <Text style={{ color: colors.background }}>✓</Text>}
```

---

## 3. Are They the Same Interface?

**YES**, both use the same `CompletedSet` interface from [lib/types.ts](lib/types.ts#L79-L88).

However, they have **different semantic meanings**:

| Aspect | Template Sets | Workout Sets |
|--------|---------------|--------------|
| **Interface** | `CompletedSet` | `CompletedSet` |
| **`completed` flag** | Set to `false`, never toggled | Set to `false`, actively toggled |
| **Storage** | Stripped away, only `reps/weight/unit` | Preserved as-is |
| **Purpose** | Configuration template | Execution tracking |
| **Rendering** | Input fields for reps/weight | Checkbox to mark sets done |

---

## 4. Why Template Sets Exclude the `completed` Flag Check

### The Reason:
Templates represent **planned workout configurations**, not executed workouts. When templates are loaded into an active workout, the `completed` flag is initialized to `false` for each set to indicate they haven't been done yet.

### Key Points:
1. **Templates don't track execution** - They're blueprints/plans
   - Only store `reps`, `weight`, and `unit` in `TemplateSetConfig`
   
2. **The `completed` flag is irrelevant to templates**
   - Templates never check `if (set.completed)`
   - Templates never filter `sets.filter(s => s.completed)`
   - Only active workouts need to distinguish completed vs. skipped sets

3. **When loading a template into a workout**:
   - Template's `TemplateSetConfig` → `CompletedSet` with `completed: false`
   - Active workout then allows toggling `completed` to track execution

4. **When saving template updates**:
   - The `completed` flag is explicitly stripped out
   - [Line 549-554](app/_hidden/templates/create.tsx#L549-L554) shows:
     ```typescript
     const setDetails = ex.sets.map(set => ({
       reps: set.reps,
       weight: set.weight,
       unit: set.unit,
       // 'completed' is not included
     }));
     ```

### Storage Architecture:
```
TemplateSetConfig (stored in DB)
  ├── reps
  ├── weight
  └── unit
       ↓
       └── CompletedSet (in-memory during template editing)
            ├── setNumber
            ├── reps
            ├── weight
            ├── unit
            ├── timestamp
            ├── completed: false (irrelevant for templates)
            ├── isRepsPlaceholder
            └── isWeightPlaceholder
                 ↓
                 └── CompletedSet (in-memory during active workout)
                      └── completed: boolean (actively toggled)
```

---

## Summary Table

| Property | Templates | Active Workouts |
|----------|-----------|-----------------|
| **Data Structure** | `CompletedSet[]` | `CompletedSet[]` |
| **Same Interface?** | ✅ Yes | ✅ Yes |
| **`completed` Used?** | ❌ Never checked | ✅ Always tracked |
| **`completed` Stored?** | ❌ Stripped on save | ✅ Preserved |
| **Sets Represent** | Planned configuration | Actual execution |
| **Rendering** | Editable text inputs | Clickable checkboxes |
| **Purpose** | Reusable templates | Session tracking |

