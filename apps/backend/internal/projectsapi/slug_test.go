package projectsapi

import (
	"strings"
	"testing"
)

func TestDeriveSlug(t *testing.T) {
	cases := []struct{ in, want string }{
		{"My App", "my-app"},
		{"  Hello,   World!!  ", "hello-world"},
		{"already-a-slug", "already-a-slug"},
		{"UPPER_case__mix", "upper-case-mix"},
		{"--leading and trailing--", "leading-and-trailing"},
		{"v2.0 Release", "v2-0-release"},
		{"naïve café", "na-ve-caf"},
		{"日本語", "project"},
		{"", "project"},
		{"!!!", "project"},
		{strings.Repeat("a", 100), strings.Repeat("a", 63)},
		{strings.Repeat("a", 62) + " b", strings.Repeat("a", 62)}, // cut lands on '-', trimmed
	}
	for _, c := range cases {
		if got := DeriveSlug(c.in); got != c.want {
			t.Errorf("DeriveSlug(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestDeriveSlugAlwaysValid(t *testing.T) {
	for _, in := range []string{"x", "A B", "a--b", strings.Repeat("ab ", 40), "-", "9 lives"} {
		got := DeriveSlug(in)
		if len(got) == 0 || len(got) > 63 || strings.HasPrefix(got, "-") || strings.HasSuffix(got, "-") || strings.Contains(got, "--") {
			t.Errorf("DeriveSlug(%q) = %q is not a valid slug", in, got)
		}
	}
}

func TestSlugWithSuffix(t *testing.T) {
	if got := slugWithSuffix("my-app", 2); got != "my-app-2" {
		t.Errorf("got %q", got)
	}
	long := strings.Repeat("a", 63)
	got := slugWithSuffix(long, 12)
	if len(got) != 63 || !strings.HasSuffix(got, "-12") {
		t.Errorf("long base: got %q (len %d)", got, len(got))
	}
	// Base that ends in '-' after truncation must not produce "--N".
	got = slugWithSuffix(strings.Repeat("a", 60)+"-bcd", 3)
	if strings.Contains(got, "--") || len(got) > 63 {
		t.Errorf("got %q", got)
	}
}
