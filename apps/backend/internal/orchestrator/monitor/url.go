package monitor

import (
	"fmt"
	"strconv"
	"strings"
)

// FormatPublicURL builds the deployment public URL.
// scheme defaults to https and must be http or https.
// port is omitted when empty, 80, or 443.
func FormatPublicURL(scheme, host, port string) (string, error) {
	scheme = strings.ToLower(strings.TrimSpace(scheme))
	if scheme == "" {
		scheme = "https"
	}
	if scheme != "http" && scheme != "https" {
		return "", fmt.Errorf("monitor: public url scheme %q must be http or https", scheme)
	}
	host = strings.TrimSpace(host)
	if host == "" {
		return "", fmt.Errorf("monitor: public url host is empty")
	}
	port = strings.TrimSpace(port)
	if port == "80" || port == "443" {
		port = ""
	}
	if port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return "", fmt.Errorf("monitor: public url port %q is invalid", port)
		}
		return scheme + "://" + host + ":" + port, nil
	}
	return scheme + "://" + host, nil
}
