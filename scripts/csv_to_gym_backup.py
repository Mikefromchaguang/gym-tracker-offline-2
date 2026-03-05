#!/usr/bin/env python3
"""
Convert workout CSV (from another app) into this app's backup JSON format.

Output can be imported from Settings -> Restore Data -> Import Backup File.

Example:
  python scripts/csv_to_gym_backup.py \
    --input "d:\\Downloads\\7da-11f1-b463-dfafe1ec4330.csv" \
    --output "d:\\Downloads\\converted-backup.json" \
    --weight-unit lbs
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# -----------------------------
# App-compatible defaults/types
# -----------------------------

DEFAULT_SETTINGS = {
    "weightUnit": "lbs",
    "theme": "auto",
    "defaultRestTime": 90,
    "autoProgressionEnabled": False,
    "defaultAutoProgressionMinReps": 8,
    "defaultAutoProgressionMaxReps": 12,
    "defaultAutoProgressionWeightIncrement": 2.5,
    "autoProgressionUpdateSetsFirst": False,
    "bodyMapGender": "male",
    "weekStartDay": 0,
    "showQuotes": True,
    "restCountDirection": "down",
    "lastUpdated": 0,
}

MUSCLE_GROUPS = {
    "chest", "deltoids-front", "deltoids-side", "deltoids-rear", "deltoids",
    "biceps", "forearm", "forearms", "abs", "obliques", "trapezius", "upper-back",
    "lower-back", "triceps", "lats", "quadriceps", "adductors", "tibialis", "knees",
    "gluteal", "hamstring", "calves", "neck", "hands", "feet", "ankles", "head", "hair"
}

def now_ms() -> int:
    return int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)

def js_generate_exercise_id(name: str) -> str:
    """Match app's generateExerciseIdFromName() behavior from lib/types.ts."""
    h = 0
    s = name.lower()
    for ch in s:
        h = ((h << 5) - h) + ord(ch)
        h &= 0xFFFFFFFF
    if h & 0x80000000:
        h = -((~h + 1) & 0xFFFFFFFF)
    base36 = to_base36(abs(h))
    hash_str = base36.rjust(6, "0")[:6]
    return f"ex_{hash_str}"

def to_base36(n: int) -> str:
    if n == 0:
        return "0"
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    while n > 0:
        n, r = divmod(n, 36)
        out.append(chars[r])
    return "".join(reversed(out))

def to_int(v: str, default: int = 0) -> int:
    try:
        if v is None or str(v).strip() == "":
            return default
        return int(float(str(v).strip()))
    except Exception:
        return default

def to_float(v: str, default: float = 0.0) -> float:
    try:
        if v is None or str(v).strip() == "":
            return default
        return float(str(v).strip())
    except Exception:
        return default

def to_bool(v: str) -> bool:
    return str(v).strip().lower() in {"true", "1", "yes", "y"}

def normalize_name(name: str) -> str:
    s = (name or "").strip()
    s = s.replace("鈥檚", "'s").replace("鈥�", "'").replace("'", "'").replace("`", "'")
    s = re.sub(r"\s+", " ", s)
    return s

def date_from_ms(ms: int) -> str:
    d = dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone.utc)
    return d.date().isoformat()

def infer_primary_muscle(ex_name: str) -> str:
    n = ex_name.lower()
    rules = [
        (["bench", "chest", "pec", "fly"], "chest"),
        (["tricep", "pushdown", "extension"], "triceps"),
        (["bicep", "curl", "hammer curl"], "biceps"),
        (["lat", "pull-up", "pulldown"], "lats"),
        (["row", "rear delt", "reverse fly"], "upper-back"),
        (["shrug", "trape"], "trapezius"),
        (["squat", "leg press", "leg extension", "lunge"], "quadriceps"),
        (["leg curl", "hamstring", "rdl", "deadlift"], "hamstring"),
        (["hip thrust", "glute", "abduction"], "gluteal"),
        (["adduction", "adductor"], "adductors"),
        (["calf"], "calves"),
        (["crunch", "leg raise", "ab wheel", "abs"], "abs"),
        (["oblique", "twist"], "obliques"),
        (["shoulder", "lateral raise", "front raise"], "deltoids-front"),
        (["back extension"], "lower-back"),
    ]
    for keys, muscle in rules:
        if any(k in n for k in keys):
            return muscle
    return "upper-back"

def infer_exercise_type(weight: float, bodyweight: float, extra_weight: float, assist_weight: float) -> str:
    if bodyweight > 0 and assist_weight > 0:
        return "assisted-bodyweight"
    if bodyweight > 0 and extra_weight > 0:
        return "weighted-bodyweight"
    if bodyweight > 0 and weight <= 0 and extra_weight <= 0 and assist_weight <= 0:
        return "bodyweight"
    return "weighted"

def effective_set_weight(ex_type: str, weight: float, bodyweight: float, extra_weight: float, assist_weight: float) -> float:
    if ex_type == "assisted-bodyweight":
        return max(0.0, bodyweight - assist_weight)
    if ex_type == "weighted-bodyweight":
        return max(0.0, bodyweight + extra_weight)
    if ex_type == "bodyweight":
        return max(0.0, bodyweight)
    return max(0.0, weight)

def extract_predefined_exercise_names(types_file: Optional[Path]) -> set:
    if not types_file or not types_file.exists():
        return set()
    txt = types_file.read_text(encoding="utf-8", errors="replace")
    # match: name: 'Foo' or name: "Foo"
    pattern = re.compile(r"name\s*:\s*(['\"])(.*?)\1")
    return {normalize_name(m.group(2)) for m in pattern.finditer(txt)}

@dataclass
class SetRow:
    exercise: str
    reps: int
    weight: float
    bodyweight: float
    extra_weight: float
    assist_weight: float
    checked_ts: int
    warmup: bool
    fail: bool
    set_comment: str

@dataclass
class WorkoutGroup:
    name: str
    start: int
    end: int
    workout_comment: str = ""
    rows: List[SetRow] = field(default_factory=list)

def read_csv_rows(csv_path: Path) -> List[dict]:
    # utf-8-sig handles BOM; fallback cp1252 for windows-export edge cases
    encodings = ["utf-8-sig", "cp1252", "latin-1"]
    last_err = None
    for enc in encodings:
        try:
            with csv_path.open("r", encoding=enc, newline="") as f:
                return list(csv.DictReader(f))
        except Exception as e:
            last_err = e
    raise RuntimeError(f"Failed to read CSV with tried encodings: {last_err}")

def build_workouts(rows: List[dict], unit: str) -> Tuple[List[dict], List[dict], Dict[str, dict], List[dict]]:
    grouped: Dict[Tuple[str, int, int], WorkoutGroup] = {}
    bodyweight_by_date: Dict[str, Tuple[int, float]] = {}

    for r in rows:
        w_name = normalize_name(r.get("workout", "")) or "Imported Workout"
        start = to_int(r.get("start", "0"), 0)
        end = to_int(r.get("end", "0"), 0)
        if start <= 0:
            continue
        if end <= 0:
            end = start

        key = (w_name, start, end)
        group = grouped.get(key)
        if not group:
            group = WorkoutGroup(name=w_name, start=start, end=end)
            grouped[key] = group

        ex_name = normalize_name(r.get("exercise", ""))
        if not ex_name:
            continue

        reps = to_int(r.get("reps", "0"), 0)
        weight = to_float(r.get("weight", "0"), 0.0)
        bw = to_float(r.get("bodyweight", "0"), 0.0)
        extra = to_float(r.get("extraWeight", "0"), 0.0)
        assist = to_float(r.get("assistingWeight", "0"), 0.0)
        checked = to_int(r.get("checked", "0"), start)
        warmup = to_bool(r.get("warmup", "false"))
        fail = to_bool(r.get("fail", "false"))
        set_comment = (r.get("setComment", "") or "").strip()
        workout_comment = (r.get("workoutComment", "") or "").strip()
        if workout_comment and not group.workout_comment:
            group.workout_comment = workout_comment

        group.rows.append(SetRow(
            exercise=ex_name,
            reps=reps,
            weight=weight,
            bodyweight=bw,
            extra_weight=extra,
            assist_weight=assist,
            checked_ts=checked if checked > 0 else start,
            warmup=warmup,
            fail=fail,
            set_comment=set_comment,
        ))

        if bw > 0:
            d = date_from_ms(start)
            prev = bodyweight_by_date.get(d)
            if not prev or checked > prev[0]:
                bodyweight_by_date[d] = (checked, bw)

    workouts_out: List[dict] = []
    custom_meta: Dict[str, dict] = {}

    # For exercise volume logs: key = (exercise_id, date)
    best_set_by_ex_day: Dict[Tuple[str, str], dict] = {}

    for (_, start, end), group in sorted(grouped.items(), key=lambda kv: kv[0][1]):
        by_ex: Dict[str, List[SetRow]] = {}
        for s in group.rows:
            by_ex.setdefault(s.exercise, []).append(s)

        completed_exercises: List[dict] = []

        for ex_name, sets in by_ex.items():
            sets.sort(key=lambda x: x.checked_ts)
            ex_id = js_generate_exercise_id(ex_name)

            # Infer exercise-level metadata from first set with some signal
            pivot = sets[0]
            for cand in sets:
                if cand.bodyweight > 0 or cand.extra_weight > 0 or cand.assist_weight > 0 or cand.weight > 0:
                    pivot = cand
                    break

            ex_type = infer_exercise_type(
                pivot.weight, pivot.bodyweight, pivot.extra_weight, pivot.assist_weight
            )

            completed_sets: List[dict] = []
            for idx, s in enumerate(sets, start=1):
                set_type = "warmup" if s.warmup else ("failure" if s.fail else "working")

                # Store raw "weight" as app expects in set; for BW variants, keep helper-based values
                if ex_type == "assisted-bodyweight":
                    set_weight = max(0.0, s.assist_weight)
                elif ex_type == "weighted-bodyweight":
                    set_weight = max(0.0, s.extra_weight)
                elif ex_type == "bodyweight":
                    set_weight = 0.0
                else:
                    set_weight = max(0.0, s.weight)

                completed_sets.append({
                    "setNumber": idx,
                    "reps": max(0, s.reps),
                    "weight": round(set_weight, 4),
                    "unit": unit,
                    "timestamp": s.checked_ts if s.checked_ts > 0 else start,
                    "completed": True,
                    "setType": set_type,
                })

                # Compute best-set volume for ExerciseVolumeLog (skip warmups)
                if set_type != "warmup" and s.reps > 0:
                    vol_weight = effective_set_weight(
                        ex_type,
                        s.weight,
                        s.bodyweight,
                        s.extra_weight,
                        s.assist_weight,
                    )
                    vol = vol_weight * s.reps
                    day = date_from_ms(start)
                    k = (ex_id, day)
                    prev = best_set_by_ex_day.get(k)
                    ts = s.checked_ts if s.checked_ts > 0 else start
                    if (prev is None) or (vol > prev["volume"]) or (vol == prev["volume"] and ts > prev["timestamp"]):
                        best_set_by_ex_day[k] = {
                            "exerciseId": ex_id,
                            "date": day,
                            "volume": round(vol, 6),
                            "reps": int(s.reps),
                            "weight": round(vol_weight, 4),
                            "unit": unit,
                            "timestamp": ts,
                            "source": "workout",
                        }

            completed_exercises.append({
                "id": f"{ex_id}_{start}",
                "exerciseId": ex_id,
                "name": ex_name,
                "sets": completed_sets,
                "type": ex_type,
                "restTimer": 90,
                "timerEnabled": True,
            })

            # Prepare fallback custom exercise metadata (used if not predefined)
            if ex_name not in custom_meta:
                pm = infer_primary_muscle(ex_name)
                if pm not in MUSCLE_GROUPS:
                    pm = "upper-back"
                custom_meta[ex_name] = {
                    "id": ex_id,
                    "name": ex_name,
                    "primaryMuscle": pm,
                    "secondaryMuscles": [],
                    "exerciseType": ex_type,
                    "muscleContributions": {pm: 100},
                }

        workout = {
            "id": f"w_{start}_{abs(hash(group.name)) % 1000000}",
            "name": group.name,
            "startTime": start,
            "endTime": max(end, start),
            "exercises": completed_exercises,
        }
        if group.workout_comment:
            workout["notes"] = group.workout_comment

        workouts_out.append(workout)

    # Body weight logs from csv bodyweight column
    bodyweight_logs: List[dict] = []
    for d, (ts, bw) in sorted(bodyweight_by_date.items(), key=lambda kv: kv[0]):
        bodyweight_logs.append({
            "date": d,
            "weight": round(bw, 4),
            "unit": unit,
            "timestamp": ts,
        })

    exercise_volume_logs = sorted(best_set_by_ex_day.values(), key=lambda x: x["timestamp"])

    return workouts_out, bodyweight_logs, custom_meta, exercise_volume_logs

def main() -> None:
    p = argparse.ArgumentParser(description="Convert external workout CSV into gym-tracker backup JSON")
    p.add_argument("--input", required=True, help="Path to source CSV")
    p.add_argument("--output", required=False, help="Path to output JSON (default: next to input)")
    p.add_argument("--weight-unit", choices=["kg", "lbs"], default="lbs", help="Interpret weight/bodyweight unit")
    p.add_argument("--types-file", default="lib/types.ts", help="Path to app types.ts to detect predefined exercises")
    args = p.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        raise SystemExit(f"Input file not found: {in_path}")

    out_path = Path(args.output) if args.output else in_path.with_suffix(".backup.json")

    rows = read_csv_rows(in_path)
    workouts, bodyweight_logs, custom_meta, exercise_volume_logs = build_workouts(rows, args.weight_unit)

    # Keep only unknown exercises as custom exercises
    predefined = extract_predefined_exercise_names(Path(args.types_file))
    custom_exercises = [
        meta for name, meta in sorted(custom_meta.items(), key=lambda kv: kv[0].lower())
        if normalize_name(name) not in predefined
    ]

    ts_now = now_ms()
    settings = {**DEFAULT_SETTINGS, "weightUnit": args.weight_unit, "lastUpdated": ts_now}

    backup = {
        "version": "2.1.0",
        "exportedAt": ts_now,
        "templates": [],
        "weekPlans": [],
        "activeWeekPlanId": None,
        "workouts": workouts,
        "settings": settings,
        "customExercises": custom_exercises,
        "bodyWeightLogs": bodyweight_logs,
        "exerciseVolumeLogs": exercise_volume_logs,
        "predefinedExerciseCustomizations": {},
        "activeWorkoutState": None,
        "restDays": [],
        "uiPreferences": {},
        "appStorage": {},
    }

    out_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")

    print("✅ Done")
    print(f"Input rows: {len(rows)}")
    print(f"Workouts: {len(workouts)}")
    print(f"Custom exercises: {len(custom_exercises)}")
    print(f"Body weight logs: {len(bodyweight_logs)}")
    print(f"Exercise volume logs: {len(exercise_volume_logs)}")
    print(f"Output: {out_path}")

if __name__ == "__main__":
    main()