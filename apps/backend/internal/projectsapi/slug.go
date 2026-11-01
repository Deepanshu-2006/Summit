package projectsapi

import (
	"strconv"
	"strings"
)

const (
	maxSlugLen   = 63
	fallbackSlug = "project"
)

// DeriveSlug turns a project name into a DNS-label slug: lowercase, every run
// of characters outside [a-z0-9] becomes a single '-', leading/trailing '-'
// are trimmed, and the result is capped at 63 characters. An empty result
// falls back to "project".
func DeriveSlug(name string) string {
	var b strings.Builder
	pendingDash := false
	for _, r := range strings.ToLower(name) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			if pendingDash && b.Len() > 0 {
				b.WriteByte('-')
			}
			pendingDash = false
			b.WriteRune(r)
			continue
		}
		pendingDash = true
	}
	s := trimSlug(b.String(), maxSlugLen)
	if s == "" {
		return fallbackSlug
	}
	return s
}

// slugWithSuffix returns base-n, shortening base so the result stays within 63 characters.
func slugWithSuffix(base string, n int) string {
	suffix := "-" + strconv.Itoa(n)
	return trimSlug(base, maxSlugLen-len(suffix)) + suffix
}

func trimSlug(s string, max int) string {
	if len(s) > max {
		s = s[:max]
	}
	return strings.Trim(s, "-")
}
