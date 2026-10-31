package workloads

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"sigs.k8s.io/yaml"
)

type customResourceDefinition struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Metadata   struct {
		Name   string            `json:"name"`
		Labels map[string]string `json:"labels"`
	} `json:"metadata"`
	Spec struct {
		Group string `json:"group"`
		Names struct {
			Kind       string   `json:"kind"`
			ListKind   string   `json:"listKind"`
			Plural     string   `json:"plural"`
			Singular   string   `json:"singular"`
			ShortNames []string `json:"shortNames"`
		} `json:"names"`
		Scope    string `json:"scope"`
		Versions []struct {
			Name         string `json:"name"`
			Served       bool   `json:"served"`
			Storage      bool   `json:"storage"`
			Subresources struct {
				Status map[string]interface{} `json:"status"`
			} `json:"subresources"`
			Schema struct {
				OpenAPIV3Schema map[string]interface{} `json:"openAPIV3Schema"`
			} `json:"schema"`
		} `json:"versions"`
	} `json:"spec"`
}

func findCRDPath(t *testing.T) string {
	candidates := []string{
		"../../../../config/crd/summit.dev_summitservices.yaml",
		"../../../config/crd/summit.dev_summitservices.yaml",
		"../../config/crd/summit.dev_summitservices.yaml",
		"config/crd/summit.dev_summitservices.yaml",
	}

	for _, c := range candidates {
		abs, err := filepath.Abs(c)
		if err == nil {
			if _, err := os.Stat(abs); err == nil {
				return abs
			}
		}
	}
	t.Fatalf("could not locate summit.dev_summitservices.yaml in candidate locations")
	return ""
}

func TestCRD_SchemaValidation(t *testing.T) {
	crdPath := findCRDPath(t)
	data, err := os.ReadFile(crdPath)
	if err != nil {
		t.Fatalf("failed reading CRD file from %s: %v", crdPath, err)
	}

	var crd customResourceDefinition
	if err := yaml.Unmarshal(data, &crd); err != nil {
		t.Fatalf("failed unmarshaling CRD YAML: %v", err)
	}

	if crd.APIVersion != "apiextensions.k8s.io/v1" {
		t.Errorf("expected apiVersion apiextensions.k8s.io/v1, got %s", crd.APIVersion)
	}
	if crd.Kind != "CustomResourceDefinition" {
		t.Errorf("expected kind CustomResourceDefinition, got %s", crd.Kind)
	}
	if crd.Metadata.Name != "summitservices.summit.dev" {
		t.Errorf("expected metadata.name summitservices.summit.dev, got %s", crd.Metadata.Name)
	}

	// Spec names and group
	if crd.Spec.Group != "summit.dev" {
		t.Errorf("expected group summit.dev, got %s", crd.Spec.Group)
	}
	if crd.Spec.Names.Kind != "SummitService" {
		t.Errorf("expected names.kind SummitService, got %s", crd.Spec.Names.Kind)
	}
	if crd.Spec.Names.Plural != "summitservices" {
		t.Errorf("expected names.plural summitservices, got %s", crd.Spec.Names.Plural)
	}
	if crd.Spec.Names.Singular != "summitservice" {
		t.Errorf("expected names.singular summitservice, got %s", crd.Spec.Names.Singular)
	}
	if crd.Spec.Scope != "Namespaced" {
		t.Errorf("expected scope Namespaced, got %s", crd.Spec.Scope)
	}

	// Versions
	if len(crd.Spec.Versions) != 1 {
		t.Fatalf("expected 1 version, got %d", len(crd.Spec.Versions))
	}
	v := crd.Spec.Versions[0]
	if v.Name != "v1alpha1" {
		t.Errorf("expected version name v1alpha1, got %s", v.Name)
	}
	if !v.Served || !v.Storage {
		t.Errorf("expected version served=true and storage=true")
	}
	if v.Subresources.Status == nil {
		t.Errorf("expected subresources.status enabled")
	}

	// OpenAPI v3 validation
	schema := v.Schema.OpenAPIV3Schema
	if schema == nil {
		t.Fatalf("expected openAPIV3Schema to be present")
	}

	props, ok := schema["properties"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected properties in openAPIV3Schema")
	}

	specProp, ok := props["spec"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected spec property in openAPIV3Schema")
	}

	specFields, ok := specProp["properties"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected properties in spec schema")
	}

	imageField, ok := specFields["image"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected image property in spec schema")
	}

	pattern, ok := imageField["pattern"].(string)
	if !ok || pattern == "" {
		t.Fatalf("expected pattern regex on image property for digest validation")
	}

	patternRegex, err := regexp.Compile(pattern)
	if err != nil {
		t.Fatalf("invalid pattern regex %q: %v", pattern, err)
	}

	// Test that the schema regex accepts valid digest and rejects mutable tags
	validDigest := "ghcr.io/org/repo@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
	invalidTag := "ghcr.io/org/repo:latest"
	if !patternRegex.MatchString(validDigest) {
		t.Errorf("expected CRD image pattern to match valid digest %s", validDigest)
	}
	if patternRegex.MatchString(invalidTag) {
		t.Errorf("expected CRD image pattern to reject mutable tag %s", invalidTag)
	}
}
