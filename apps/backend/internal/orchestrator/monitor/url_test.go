package monitor

import "testing"

func TestFormatPublicURL(t *testing.T) {
	cases := []struct {
		scheme, host, port, want string
	}{
		{"", "api.localtest.me", "", "https://api.localtest.me"},
		{"https", "api.localtest.me", "", "https://api.localtest.me"},
		{"https", "api.localtest.me", "443", "https://api.localtest.me"},
		{"http", "api.localtest.me", "80", "http://api.localtest.me"},
		{"http", "api.localtest.me", "", "http://api.localtest.me"},
		{"HTTP", "api.localtest.me", "8080", "http://api.localtest.me:8080"},
		{"https", "api.localtest.me", "8443", "https://api.localtest.me:8443"},
	}
	for _, c := range cases {
		got, err := FormatPublicURL(c.scheme, c.host, c.port)
		if err != nil || got != c.want {
			t.Errorf("FormatPublicURL(%q,%q,%q)=%q,%v want %q", c.scheme, c.host, c.port, got, err, c.want)
		}
	}
	if _, err := FormatPublicURL("ftp", "h", ""); err == nil {
		t.Fatal("ftp accepted")
	}
	if _, err := FormatPublicURL("http", "h", "0"); err == nil {
		t.Fatal("port 0 accepted")
	}
	if _, err := FormatPublicURL("http", "", "8080"); err == nil {
		t.Fatal("empty host accepted")
	}
}
