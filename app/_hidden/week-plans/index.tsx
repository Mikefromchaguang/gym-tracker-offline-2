import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function WeekPlansScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/_hidden/week-plans/edit');
  }, [router]);

  return null;
}
