from datetime import timedelta

import pytest

from app.sm2 import AGAIN, EASY, GOOD, HARD, MIN_EASE, Sm2State, review


def test_new_card_good_gives_one_day():
    r = review(Sm2State(), GOOD)
    assert r.state.interval_days == 1.0
    assert r.state.repetitions == 1
    assert r.due_in == timedelta(days=1)


def test_second_good_gives_six_days():
    r = review(Sm2State(repetitions=1, interval_days=1.0), GOOD)
    assert r.state.interval_days == 6.0


def test_third_good_multiplies_by_ease():
    r = review(Sm2State(repetitions=2, interval_days=6.0, ease_factor=2.5), GOOD)
    assert r.state.interval_days == 15.0  # 6 * 2.5


def test_again_resets_and_relearns_quickly():
    r = review(Sm2State(repetitions=3, interval_days=15.0, ease_factor=2.5), AGAIN)
    assert r.state.repetitions == 0
    assert r.state.lapses == 1
    assert r.state.ease_factor == 2.3
    assert r.due_in == timedelta(minutes=10)


def test_again_on_new_card_is_not_a_lapse():
    r = review(Sm2State(), AGAIN)
    assert r.state.lapses == 0


def test_ease_never_drops_below_floor():
    state = Sm2State(ease_factor=MIN_EASE)
    assert review(state, AGAIN).state.ease_factor == MIN_EASE
    assert review(state, HARD).state.ease_factor == MIN_EASE


def test_hard_grows_slowly_and_reduces_ease():
    r = review(Sm2State(repetitions=2, interval_days=10.0, ease_factor=2.5), HARD)
    assert r.state.interval_days == 12.0  # 10 * 1.2
    assert r.state.ease_factor == 2.35


def test_easy_applies_bonus_and_raises_ease():
    r = review(Sm2State(repetitions=2, interval_days=10.0, ease_factor=2.0), EASY)
    assert r.state.interval_days == 26.0  # 10 * 2.0 * 1.3
    assert r.state.ease_factor == 2.15


def test_easy_on_new_card_jumps_ahead():
    r = review(Sm2State(), EASY)
    assert r.state.interval_days == 4.0


def test_interval_is_capped():
    r = review(Sm2State(repetitions=5, interval_days=300.0, ease_factor=2.5), GOOD)
    assert r.state.interval_days == 365.0
    assert r.due_in == timedelta(days=365)


def test_invalid_rating_raises():
    with pytest.raises(ValueError):
        review(Sm2State(), 5)
