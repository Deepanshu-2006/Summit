package githubwebhook

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestReadBody(t *testing.T) {
	t.Run("valid body within limit", func(t *testing.T) {
		content := `{"hello":"world"}`
		req, _ := http.NewRequest(http.MethodPost, "/webhook", strings.NewReader(content))
		req.ContentLength = int64(len(content))

		body, err := ReadBody(req, 1024)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(body) != content {
			t.Fatalf("expected body %q, got %q", content, string(body))
		}
	})

	t.Run("body exceeding limit via ContentLength header", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodPost, "/webhook", strings.NewReader("small"))
		req.ContentLength = 2000 // claims to be 2000 bytes

		body, err := ReadBody(req, 1000)
		if !errors.Is(err, ErrBodyTooLarge) {
			t.Errorf("expected ErrBodyTooLarge, got %v", err)
		}
		if body != nil {
			t.Errorf("expected body to be nil to reject partial trust, got %d bytes", len(body))
		}
	})

	t.Run("body exceeding limit via stream without ContentLength", func(t *testing.T) {
		largeContent := strings.Repeat("A", 1500)
		req, _ := http.NewRequest(http.MethodPost, "/webhook", strings.NewReader(largeContent))
		req.ContentLength = -1 // unknown length

		body, err := ReadBody(req, 1000)
		if !errors.Is(err, ErrBodyTooLarge) {
			t.Errorf("expected ErrBodyTooLarge, got %v", err)
		}
		if body != nil {
			t.Errorf("expected body to be nil to prevent partial trust, got %d bytes", len(body))
		}
	})

	t.Run("exact limit boundary", func(t *testing.T) {
		content := strings.Repeat("B", 100)
		req, _ := http.NewRequest(http.MethodPost, "/webhook", strings.NewReader(content))
		req.ContentLength = 100

		body, err := ReadBody(req, 100)
		if err != nil {
			t.Fatalf("expected body of exact limit to succeed, got %v", err)
		}
		if len(body) != 100 {
			t.Fatalf("expected 100 bytes, got %d", len(body))
		}
	})

	t.Run("default limit used when maxBytes <= 0", func(t *testing.T) {
		content := strings.Repeat("C", 100)
		req, _ := http.NewRequest(http.MethodPost, "/webhook", strings.NewReader(content))

		body, err := ReadBody(req, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(body) != 100 {
			t.Fatalf("expected 100 bytes, got %d", len(body))
		}
	})

	t.Run("nil request or nil body", func(t *testing.T) {
		_, err := ReadBody(nil, 1000)
		if !errors.Is(err, ErrNilRequestBody) {
			t.Errorf("expected ErrNilRequestBody for nil req, got %v", err)
		}

		req, _ := http.NewRequest(http.MethodPost, "/webhook", nil)
		_, err = ReadBody(req, 1000)
		if !errors.Is(err, ErrNilRequestBody) {
			t.Errorf("expected ErrNilRequestBody for req with nil body, got %v", err)
		}
	})

	t.Run("body read error propagates", func(t *testing.T) {
		expectedErr := errors.New("read fault")
		req, _ := http.NewRequest(http.MethodPost, "/webhook", &errReader{err: expectedErr})
		req.ContentLength = 10

		_, err := ReadBody(req, 100)
		if !errors.Is(err, expectedErr) {
			t.Errorf("expected read fault error, got %v", err)
		}
	})
}

func TestPayloadSHA256(t *testing.T) {
	data := []byte("summit-control-plane-payload")
	expectedSum := sha256.Sum256(data)
	expectedHex := hex.EncodeToString(expectedSum[:])

	actualHex := PayloadSHA256(data)
	if actualHex != expectedHex {
		t.Errorf("expected %s, got %s", expectedHex, actualHex)
	}

	emptySum := sha256.Sum256([]byte{})
	if PayloadSHA256([]byte{}) != hex.EncodeToString(emptySum[:]) {
		t.Errorf("empty payload checksum mismatch")
	}
}

type errReader struct {
	err error
}

func (r *errReader) Read(p []byte) (n int, err error) {
	return 0, r.err
}

func (r *errReader) Close() error {
	return nil
}

var _ io.ReadCloser = (*errReader)(nil)
