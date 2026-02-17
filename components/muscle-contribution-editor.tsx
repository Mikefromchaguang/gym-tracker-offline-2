import React, { useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import type { MuscleGroup } from '@/lib/types';
import { calculateDefaultContributions } from '@/lib/muscle-contribution';
import { getMuscleGroupDisplayName } from '@/lib/muscle-groups';
import { useColors } from '@/hooks/use-colors';
import { getExerciseMusclesByNameOrId } from '@/lib/types';

interface MuscleContributionEditorProps {
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  contributions: Record<MuscleGroup, number>;
  onContributionsChange: (contributions: Record<MuscleGroup, number>) => void;
  autoCalculate?: boolean; // Whether to auto-calculate when muscles change
  /** Optional: used to make a smarter conversion when legacy 'deltoids' is present. */
  exerciseNameOrId?: string;
  /** Optional: if provided, the editor can also convert muscle selections from legacy 'deltoids' to subgroups. */
  onMusclesChange?: (primary: MuscleGroup | null, secondary: MuscleGroup[]) => void;
}

type DeltoidSubgroup = 'deltoids-front' | 'deltoids-side' | 'deltoids-rear';

function isDeltoidSubgroup(muscle: string): muscle is DeltoidSubgroup {
  return muscle === 'deltoids-front' || muscle === 'deltoids-side' || muscle === 'deltoids-rear';
}

function inferDeltoidSubgroupFromName(nameOrId: string): DeltoidSubgroup {
  const n = (nameOrId || '').toLowerCase();
  if (n.includes('lateral raise') || n.includes('lateral  raise') || n.includes('side raise') || n.includes('side delt')) {
    return 'deltoids-side';
  }
  if (n.includes('face pull') || n.includes('rear') || n.includes('reverse') || n.includes('rear delt') || n.includes('reverse fly')) {
    return 'deltoids-rear';
  }
  return 'deltoids-front';
}

function dedupeMuscles(muscles: MuscleGroup[]): MuscleGroup[] {
  return muscles.filter((m, idx) => muscles.indexOf(m) === idx);
}

function renormalizeSelectedTo100(
  contributions: Record<MuscleGroup, number>,
  selected: MuscleGroup[]
): Record<MuscleGroup, number> {
  const total = selected.reduce((sum, m) => sum + (contributions[m] || 0), 0);
  if (!Number.isFinite(total) || total === 0) return contributions;
  if (Math.abs(total - 100) < 0.01) return contributions;

  const scaled: Record<MuscleGroup, number> = { ...contributions };
  selected.forEach((m) => {
    scaled[m] = ((scaled[m] || 0) / total) * 100;
  });
  // Fix rounding drift by adjusting the largest selected bucket.
  const scaledTotal = selected.reduce((sum, m) => sum + (scaled[m] || 0), 0);
  const delta = 100 - scaledTotal;
  let maxMuscle: MuscleGroup | null = null;
  let maxVal = -Infinity;
  selected.forEach((m) => {
    const v = scaled[m] || 0;
    if (v > maxVal) {
      maxVal = v;
      maxMuscle = m;
    }
  });
  if (maxMuscle) scaled[maxMuscle] = ((scaled[maxMuscle] as number) || 0) + delta;
  return scaled;
}

export function MuscleContributionEditor({
  primaryMuscle,
  secondaryMuscles,
  contributions,
  onContributionsChange,
  autoCalculate = true,
  exerciseNameOrId,
  onMusclesChange,
}: MuscleContributionEditorProps) {
  const colors = useColors();

  // Auto-calculate contributions when muscles change
  useEffect(() => {
    if (autoCalculate && primaryMuscle) {
      const defaults = calculateDefaultContributions(primaryMuscle, secondaryMuscles);
      onContributionsChange(defaults);
    }
  }, [primaryMuscle, secondaryMuscles?.join(','), autoCalculate]);

  if (!primaryMuscle) {
    return null;
  }

  const hasLegacyDeltoids =
    primaryMuscle === 'deltoids' ||
    secondaryMuscles.includes('deltoids') ||
    typeof (contributions as any)?.deltoids === 'number';

  const handleAutoSplitDeltoids = () => {
    const key = exerciseNameOrId || '';
    const canonical = key ? getExerciseMusclesByNameOrId(key) : undefined;

    const suggestedPrimary: DeltoidSubgroup =
      canonical && isDeltoidSubgroup(canonical.primaryMuscle)
        ? canonical.primaryMuscle
        : inferDeltoidSubgroupFromName(key);

    const canonicalDelts: DeltoidSubgroup[] = [];
    if (canonical) {
      if (isDeltoidSubgroup(canonical.primaryMuscle)) canonicalDelts.push(canonical.primaryMuscle);
      (canonical.secondaryMuscles || []).forEach((m) => {
        if (isDeltoidSubgroup(m)) canonicalDelts.push(m);
      });
      Object.keys(canonical.muscleContributions || {}).forEach((m) => {
        if (isDeltoidSubgroup(m)) canonicalDelts.push(m);
      });
    }
    const suggestedDelts = dedupeMuscles(
      (canonicalDelts.length ? canonicalDelts : [suggestedPrimary]) as unknown as MuscleGroup[]
    ) as unknown as DeltoidSubgroup[];

    // 1) Update muscle selection if caller supports it.
    if (onMusclesChange) {
      let nextPrimary: MuscleGroup | null = primaryMuscle;
      let nextSecondary = [...secondaryMuscles];

      if (primaryMuscle === 'deltoids') {
        nextPrimary = suggestedPrimary;
      }
      if (nextSecondary.includes('deltoids')) {
        nextSecondary = nextSecondary.filter((m) => m !== 'deltoids');
        for (const d of suggestedDelts) {
          if (d !== nextPrimary) nextSecondary.push(d);
        }
      }
      // If primary is now a delt subgroup, ensure we don't also include it in secondary.
      if (nextPrimary) {
        nextSecondary = nextSecondary.filter((m) => m !== nextPrimary);
      }
      onMusclesChange(nextPrimary, dedupeMuscles(nextSecondary));
    }

    // 2) Convert contributions.
    const legacy = (contributions as any)?.deltoids;
    const legacyValue = typeof legacy === 'number' ? legacy : 0;

    const next: Record<MuscleGroup, number> = { ...contributions };
    // Remove legacy key so totals don't “double count”.
    delete (next as any).deltoids;

    if (legacyValue > 0) {
      if (canonical?.muscleContributions) {
        const weights: Array<[DeltoidSubgroup, number]> = (Object.entries(canonical.muscleContributions) as Array<[string, number]>)
          .filter(([m, v]) => isDeltoidSubgroup(m) && typeof v === 'number' && v > 0)
          .map(([m, v]) => [m as DeltoidSubgroup, v]);
        const wTotal = weights.reduce((sum, [, v]) => sum + v, 0);
        if (wTotal > 0) {
          weights.forEach(([m, v]) => {
            next[m] = (next[m] || 0) + (legacyValue * v) / wTotal;
          });
        } else {
          next[suggestedPrimary] = (next[suggestedPrimary] || 0) + legacyValue;
        }
      } else {
        next[suggestedPrimary] = (next[suggestedPrimary] || 0) + legacyValue;
      }
    }

    // Keep totals sane for currently-selected muscles.
    const selectedAfter: MuscleGroup[] = (() => {
      const primaryAfter = (primaryMuscle === 'deltoids' ? suggestedPrimary : primaryMuscle) as MuscleGroup;
      const secondaryAfter = secondaryMuscles.includes('deltoids')
        ? dedupeMuscles([
            ...secondaryMuscles.filter((m) => m !== 'deltoids'),
            ...((suggestedDelts as unknown as MuscleGroup[]).filter((m) => m !== primaryAfter)),
          ])
        : secondaryMuscles;
      return [primaryAfter, ...secondaryAfter];
    })();

    onContributionsChange(renormalizeSelectedTo100(next, selectedAfter));
  };

  const allMuscles = [primaryMuscle, ...secondaryMuscles];
  // Only sum contributions for currently selected muscles (ignore stale values from removed muscles)
  const total = allMuscles.reduce((sum, muscle) => sum + (contributions[muscle] || 0), 0);
  const isValid = Math.abs(total - 100) < 0.01; // Allow small floating point errors

  const handleContributionChange = (muscle: MuscleGroup, value: string) => {
    const numValue = parseFloat(value) || 0;
    let newContributions = {
      ...contributions,
      [muscle]: numValue,
    };

    // If primary muscle changed, auto-adjust secondaries to sum to 100%
    if (muscle === primaryMuscle && secondaryMuscles.length > 0) {
      const remaining = Math.max(0, 100 - numValue);
      const perSecondary = remaining / secondaryMuscles.length;
      secondaryMuscles.forEach(secMuscle => {
        newContributions[secMuscle] = Math.round(perSecondary * 10) / 10; // Round to 1 decimal
      });
    }

    onContributionsChange(newContributions);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Muscle Contribution
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Distribute 100% across muscles
      </Text>

      {hasLegacyDeltoids && (
        <Pressable
          onPress={handleAutoSplitDeltoids}
          style={({ pressed }) => [
            styles.helperCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.helperTitle, { color: colors.foreground }]}>Auto-split deltoids</Text>
          <Text style={[styles.helperSubtitle, { color: colors.muted }]}>Convert legacy “Deltoids” into front/side/rear delts.</Text>
        </Pressable>
      )}

      {allMuscles.map((muscle, index) => (
        <View key={muscle}>
          {index === 0 && (
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>
              Primary Muscle
            </Text>
          )}
          {index === 1 && secondaryMuscles.length > 0 && (
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>
              Secondary Muscles
            </Text>
          )}
          <View style={styles.row}>
            <Text style={[styles.muscleLabel, { color: colors.foreground }]}>
              {getMuscleGroupDisplayName(muscle)}
            </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              value={contributions[muscle]?.toString() || '0'}
              onChangeText={(value) => handleContributionChange(muscle, value)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.percentSign, { color: colors.muted }]}>%</Text>
          </View>
          </View>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, { color: colors.foreground }]}>
          Total:
        </Text>
        <Text
          style={[
            styles.totalValue,
            {
              color: isValid ? colors.success : colors.error,
            },
          ]}
        >
          {total.toFixed(1)}%
        </Text>
      </View>

      {!isValid && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          Total must equal 100%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  helperCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  helperTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  helperSubtitle: {
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginTop: -8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muscleLabel: {
    fontSize: 15,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    width: 70,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    textAlign: 'right',
  },
  percentSign: {
    fontSize: 15,
    width: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    marginTop: -4,
  },
});
