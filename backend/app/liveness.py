from __future__ import annotations


CHALLENGES = ("blink", "turn_left", "turn_right")


def validate_signals(challenge: str, signals: dict) -> tuple[bool, str]:
    if challenge not in CHALLENGES:
        return False, "unknown_challenge"

    blink_count = int(signals.get("blinkCount") or 0)
    yaw = float(signals.get("yaw") or 0)
    pitch = float(signals.get("pitch") or 0)
    ear = float(signals.get("ear") or 0)
    frames = int(signals.get("frames") or 0)
    motion = float(signals.get("motion") or 0)
    depth_var = float(signals.get("depthVar") or 0)
    screen_hint = float(signals.get("screenHint") or 0)

    if frames < 12:
        return False, "too_few_frames"
    if abs(pitch) > 28:
        return False, "look_at_camera"

    if challenge == "blink":
        if blink_count < 1 or ear > 0.28:
            return False, "blink_not_detected"
        if motion < 0.35:
            return False, "no_natural_motion"
    elif challenge == "turn_left":
        if yaw > -12:
            return False, "turn_left_not_detected"
    elif challenge == "turn_right":
        if yaw < 12:
            return False, "turn_right_not_detected"

    if screen_hint > 0.72:
        return False, "screen_like_texture"
    if depth_var < 0.04 and motion < 0.2:
        return False, "flat_image"

    return True, "ok"
