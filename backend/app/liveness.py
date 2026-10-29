from __future__ import annotations


CHALLENGES = ("blink", "turn_head", "turn_left", "turn_right")


def validate_signals(challenge: str, signals: dict) -> tuple[bool, str]:
    if challenge not in CHALLENGES:
        return False, "unknown_challenge"

    blink_count = int(signals.get("blinkCount") or 0)
    yaw = float(signals.get("yaw") or 0)
    min_yaw = float(signals.get("minYaw") if signals.get("minYaw") is not None else yaw)
    max_yaw = float(signals.get("maxYaw") if signals.get("maxYaw") is not None else yaw)
    yaw_range = float(signals.get("yawRange") if signals.get("yawRange") is not None else (max_yaw - min_yaw))
    frames = int(signals.get("frames") or 0)

    if frames < 6:
        return False, "too_few_frames"

    if challenge == "blink":
        if blink_count < 1:
            return False, "blink_not_detected"
    elif challenge in ("turn_head", "turn_left", "turn_right"):
        if yaw_range < 8 and max(abs(min_yaw), abs(max_yaw)) < 8:
            return False, "turn_left_not_detected"

    return True, "ok"
