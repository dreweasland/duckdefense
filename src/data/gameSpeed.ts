// The speeds the fast-forward button cycles through during a wave (1 = normal).
export const GAME_SPEEDS: readonly number[] = [1, 2, 3];

/**
 * Seconds after a wave starts during which the fast-forward button ignores taps. It
 * appears right where the start button was, so a kid's double-tap on "go" would
 * otherwise land on it and speed the game up by accident.
 */
export const SPEED_TAP_GUARD = 0.5;
