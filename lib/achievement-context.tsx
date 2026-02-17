import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useGym } from '@/lib/gym-context';
import { STORAGE_KEYS } from '@/lib/storage';
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  type AchievementId,
  type UnlockedAchievement,
  computeNewlyUnlockedAchievements,
  getAchievementDefinition,
} from '@/lib/achievements';
import { AchievementUnlockedModal } from '@/components/achievement-unlocked-modal';

type AchievementContextValue = {
  unlocked: UnlockedAchievement[];
  all: AchievementDefinition[];
  getById: (id: AchievementId) => AchievementDefinition | undefined;
};

const AchievementsContext = createContext<AchievementContextValue | undefined>(undefined);

export function AchievementsProvider({ children }: { children: React.ReactNode }) {
  const { workouts } = useGym();

  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [queue, setQueue] = useState<AchievementDefinition[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [suppressInitialPopups, setSuppressInitialPopups] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
        if (!raw) {
          // First run of achievements system: don't spam popups for already-existing history.
          setSuppressInitialPopups(true);
          setUnlocked([]);
          setHydrated(true);
          return;
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          setUnlocked([]);
          return;
        }

        const validIds = new Set(ACHIEVEMENTS.map((a) => a.id));
        const cleaned: UnlockedAchievement[] = [];
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const id = (item as any).id;
          const unlockedAt = (item as any).unlockedAt;
          if (typeof id !== 'string' || !validIds.has(id as any)) continue;
          if (typeof unlockedAt !== 'number') continue;
          cleaned.push({ id: id as AchievementId, unlockedAt });
        }

        setUnlocked(cleaned);
      } catch {
        setUnlocked([]);
      } finally {
        setHydrated(true);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const newlyUnlocked = computeNewlyUnlockedAchievements({ workouts, unlocked });
    if (newlyUnlocked.length === 0) {
      if (suppressInitialPopups) setSuppressInitialPopups(false);
      return;
    }

    const now = Date.now();
    const newUnlockedRecords: UnlockedAchievement[] = newlyUnlocked.map((a) => ({ id: a.id, unlockedAt: now }));
    const nextUnlocked = [...unlocked, ...newUnlockedRecords];

    setUnlocked(nextUnlocked);
    AsyncStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(nextUnlocked)).catch(() => {
      // Non-fatal
    });

    if (!suppressInitialPopups) {
      setQueue((prev) => [...prev, ...newlyUnlocked]);
    } else {
      setSuppressInitialPopups(false);
    }
  }, [hydrated, suppressInitialPopups, unlocked, workouts]);

  const modalAchievement = queue[0];

  const value = useMemo<AchievementContextValue>(
    () => ({
      unlocked,
      all: ACHIEVEMENTS,
      getById: (id: AchievementId) => getAchievementDefinition(id),
    }),
    [unlocked]
  );

  return (
    <AchievementsContext.Provider value={value}>
      {children}
      <AchievementUnlockedModal
        visible={queue.length > 0}
        title={modalAchievement?.title ?? ''}
        message={modalAchievement?.message ?? ''}
        onClose={() => setQueue((prev) => prev.slice(1))}
      />
    </AchievementsContext.Provider>
  );
}

export function useAchievements(): AchievementContextValue {
  const ctx = useContext(AchievementsContext);
  if (!ctx) throw new Error('useAchievements must be used within AchievementsProvider');
  return ctx;
}
