"""SM-2 spaced repetition with Anki-style ratings. Pure logic, no I/O.

The idea: each successful review pushes the next one further out, scaled by
the card's "ease" (how easy it has historically been). Failing a card resets
it to relearning and makes its future intervals grow more slowly.
"""

from dataclasses import dataclass
from datetime import timedelta

AGAIN, HARD, GOOD, EASY = 1, 2, 3, 4

MIN_EASE = 1.3          # below this, intervals barely grow — SM-2's floor
START_EASE = 2.5
MAX_INTERVAL_DAYS = 365.0
RELEARN_MINUTES = 10    # a failed card comes back within the same session
EASY_BONUS = 1.3


@dataclass(frozen=True)
class Sm2State:
    ease_factor: float = START_EASE
    interval_days: float = 0.0
    repetitions: int = 0    # consecutive successful reviews
    lapses: int = 0         # times a learned card was forgotten


@dataclass(frozen=True)
class Sm2Result:
    state: Sm2State
    due_in: timedelta


def review(state: Sm2State, rating: int) -> Sm2Result:
    ease = state.ease_factor
    interval = state.interval_days
    reps = state.repetitions
    lapses = state.lapses

    if rating == AGAIN:
        # Forgot it. Only counts as a lapse if the card had been learned.
        if reps > 0:
            lapses += 1
        reps = 0
        ease = max(MIN_EASE, ease - 0.20)
        interval = 0.0
        due_in = timedelta(minutes=RELEARN_MINUTES)
    elif rating == HARD:
        ease = max(MIN_EASE, ease - 0.15)
        interval = max(1.0, interval * 1.2) if reps > 0 else 1.0
        reps += 1
        due_in = timedelta(days=interval)
    elif rating == GOOD:
        if reps == 0:
            interval = 1.0
        elif reps == 1:
            interval = 6.0
        else:
            interval = interval * ease
        reps += 1
        due_in = timedelta(days=interval)
    elif rating == EASY:
        interval = 4.0 if reps == 0 else interval * ease * EASY_BONUS
        ease += 0.15
        reps += 1
        due_in = timedelta(days=interval)
    else:
        raise ValueError(f"rating must be 1-4, got {rating}")

    interval = min(interval, MAX_INTERVAL_DAYS)
    due_in = min(due_in, timedelta(days=MAX_INTERVAL_DAYS))

    new_state = Sm2State(
        ease_factor=round(ease, 2),
        interval_days=round(interval, 2),
        repetitions=reps,
        lapses=lapses,
    )
    return Sm2Result(state=new_state, due_in=due_in)
