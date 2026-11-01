package registry

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	componentRe = regexp.MustCompile(`^[a-z0-9]+(?:[._-][a-z0-9]+)*$`)
	tagRe       = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$`)
	digestRe    = regexp.MustCompile(`^sha256:[a-fA-F0-9]{64}$`)
	hostRe      = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*(?::[0-9]{1,5})?$`)
)

// parsedRef is a syntactically valid image reference.
type parsedRef struct {
	raw          string // trimmed input; returned unchanged when a digest is present
	registryHost string // host used for the registry API (registry-1.docker.io for Docker Hub)
	canonical    string // registry/repo without tag, e.g. docker.io/library/nginx
	repository   string // path under /v2/, e.g. library/nginx
	tag          string
	digest       string // sha256:<hex> when the input was already pinned
}

// ValidateRef reports whether ref is a syntactically valid image reference.
// It does not contact a registry. `nginx` and `ghcr.io/org/app:tag` are valid.
func ValidateRef(ref string) error {
	_, err := parseRef(ref)
	return err
}

func parseRef(raw string) (parsedRef, error) {
	ref := strings.TrimSpace(raw)
	if ref == "" || len(ref) > 512 || strings.ContainsAny(ref, " \t\r\n") || strings.Contains(ref, "://") {
		return parsedRef{}, fmt.Errorf("%w: %q", ErrInvalidRef, raw)
	}
	var digest string
	if i := strings.LastIndex(ref, "@"); i >= 0 {
		digest = ref[i+1:]
		ref = ref[:i]
		if !digestRe.MatchString(digest) {
			return parsedRef{}, fmt.Errorf("%w: digest must be sha256 and 64 hex characters", ErrInvalidRef)
		}
	}
	if ref == "" || strings.HasPrefix(ref, "/") || strings.HasSuffix(ref, "/") {
		return parsedRef{}, fmt.Errorf("%w: %q", ErrInvalidRef, raw)
	}

	name := ref
	tag := "latest"
	if slash := strings.LastIndex(name, "/"); slash >= 0 {
		rest := name[slash+1:]
		if colon := strings.LastIndex(rest, ":"); colon >= 0 {
			tag = rest[colon+1:]
			name = name[:slash+1+colon]
		}
	} else if colon := strings.LastIndex(name, ":"); colon >= 0 {
		tag = name[colon+1:]
		name = name[:colon]
	}
	if name == "" || !tagRe.MatchString(tag) {
		return parsedRef{}, fmt.Errorf("%w: bad name or tag in %q", ErrInvalidRef, raw)
	}

	registryHost := "registry-1.docker.io"
	canonicalReg := "docker.io"
	repository := name
	first, rest, hasSlash := strings.Cut(name, "/")
	if !hasSlash || (!strings.ContainsAny(first, ".:") && first != "localhost") {
		if !hasSlash {
			repository = "library/" + name
		}
	} else {
		if !hostRe.MatchString(first) {
			return parsedRef{}, fmt.Errorf("%w: bad registry host in %q", ErrInvalidRef, raw)
		}
		if first == "docker.io" || first == "index.docker.io" {
			registryHost = "registry-1.docker.io"
			canonicalReg = "docker.io"
		} else {
			registryHost = first
			canonicalReg = first
		}
		repository = rest
	}
	if repository == "" {
		return parsedRef{}, fmt.Errorf("%w: missing repository in %q", ErrInvalidRef, raw)
	}
	for _, part := range strings.Split(repository, "/") {
		if !componentRe.MatchString(part) {
			return parsedRef{}, fmt.Errorf("%w: bad repository name in %q", ErrInvalidRef, raw)
		}
	}
	return parsedRef{
		raw:          strings.TrimSpace(raw),
		registryHost: registryHost,
		canonical:    canonicalReg + "/" + repository,
		repository:   repository,
		tag:          tag,
		digest:       digest,
	}, nil
}
