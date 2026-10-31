package queue

import (
	"math"
	"time"
)

// BackoffStrategy computes the retry delay given the number of previous attempts.
type BackoffStrategy func(attempts int) time.Duration

const (
	// DefaultInitialBackoff is the base backoff interval for the first retry.
	DefaultInitialBackoff = 5 * time.Second
	// DefaultMaxBackoff caps the maximum backoff duration for any attempt.
	DefaultMaxBackoff = 5 * time.Minute
)

// DefaultExponentialBackoff calculates exponential backoff:
// backoff = min(maxBackoff, initialBackoff * 2^(attempts-1)).
//
// For example:
// attempt 1 -> 5s
// attempt 2 -> 10s
// attempt 3 -> 20s
// attempt 4 -> 40s
// attempt 5 -> 80s
func DefaultExponentialBackoff(attempts int) time.Duration {
	return ExponentialBackoff(attempts, DefaultInitialBackoff, DefaultMaxBackoff)
}

// ExponentialBackoff returns an exponential backoff with custom base and maximum ceilings.
func ExponentialBackoff(attempts int, initial time.Duration, max time.Duration) time.Duration {
	if attempts <= 0 {
		return initial
	}
	// Avoid integer overflow on large attempt numbers:
	// 2^(attempts-1)
	exp := attempts - 1
	if exp > 20 {
		exp = 20
	}
	multiplier := math.Pow(2, float64(exp))
	backoff := time.Duration(float64(initial) * multiplier)
	if backoff > max || backoff < 0 {
		return max
	}
	return backoff
}

// LinearBackoff returns a backoff that increases linearly with each attempt.
func LinearBackoff(step time.Duration, max time.Duration) BackoffStrategy {
	return func(attempts int) time.Duration {
		if attempts <= 0 {
			attempts = 1
		}
		backoff := step * time.Duration(attempts)
		if backoff > max {
			return max
		}
		return backoff
	}
}

// ConstantBackoff returns a constant backoff regardless of attempt count.
func ConstantBackoff(duration time.Duration) BackoffStrategy {
	return func(attempts int) time.Duration {
		return duration
	}
}
