package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/orchestrator/events"
	"github.com/summit/backend/internal/orchestrator/queue"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/workertoken"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Builder pod limits, matching the build adapter defaults (build.DefaultCPULimit etc.). The
// BuildKit cache emptyDir counts toward ephemeral storage, so storage must cover base images,
// toolchains and node_modules; 2Gi gets the pod evicted while unpacking Railpack's builder image.
const (
	builderCPUMillicores       = 2000
	builderMemoryMiB           = 4096
	builderEphemeralStorageMiB = 10240
)

// BuildContextStore retrieves the platform database build context.
type BuildContextStore interface {
	GetBuildContext(ctx context.Context, buildJobID uuid.UUID) (*platformdb.BuildContext, error)
}

// ResolverConfig contains parameters needed to resolve and enrich a BuildExecutionSpec.
type ResolverConfig struct {
	WorkerJWTSecret []byte
	APIInternalURL  string
	BuildNamespace  string
	GHCRPushSecret  string
}

// ProductionResolver resolves and enriches outbox events into full BuildExecutionSpecs,
// mints the per-build worker token, and provisions the per-build Secret (contracts C3, C4, C6).
type ProductionResolver struct {
	store      BuildContextStore
	kubeClient kubernetes.Interface
	cfg        ResolverConfig
	logger     *slog.Logger
}

// NewProductionResolver creates a new ProductionResolver.
func NewProductionResolver(store BuildContextStore, kubeClient kubernetes.Interface, cfg ResolverConfig, logger *slog.Logger) *ProductionResolver {
	if logger == nil {
		logger = slog.Default()
	}
	if cfg.BuildNamespace == "" {
		cfg.BuildNamespace = "summit-builds"
	}
	if cfg.GHCRPushSecret == "" {
		cfg.GHCRPushSecret = "ghcr-push"
	}
	if cfg.APIInternalURL == "" {
		cfg.APIInternalURL = "http://summit-api.summit-system.svc.cluster.local:4000"
	}
	return &ProductionResolver{
		store:      store,
		kubeClient: kubeClient,
		cfg:        cfg,
		logger:     logger,
	}
}

// ResolveBuildSpec maps the event and platform DB context to BuildExecutionSpec.
func (r *ProductionResolver) ResolveBuildSpec(ctx context.Context, event *events.BuildRequestedPayload, record *queue.EventRecord) (build.BuildExecutionSpec, error) {
	if event == nil {
		return build.BuildExecutionSpec{}, fmt.Errorf("resolver: build requested event is nil")
	}
	buildJobID, err := uuid.Parse(event.BuildRunID)
	if err != nil {
		return build.BuildExecutionSpec{}, fmt.Errorf("resolver: invalid build_run_id: %w", err)
	}

	bCtx, err := r.store.GetBuildContext(ctx, buildJobID)
	if err != nil {
		return build.BuildExecutionSpec{}, fmt.Errorf("resolver: querying build context: %w", err)
	}

	timeoutSec := build.DefaultTimeoutSeconds
	if bCtx.TimeoutSeconds != nil && *bCtx.TimeoutSeconds >= 10 {
		timeoutSec = *bCtx.TimeoutSeconds
	}

	// Mint worker token (TTL = build timeout + 10m per contract C3)
	ttl := time.Duration(timeoutSec)*time.Second + 10*time.Minute
	var token string
	if len(r.cfg.WorkerJWTSecret) >= workertoken.MinSecretLength {
		var mintErr error
		token, mintErr = workertoken.Mint(r.cfg.WorkerJWTSecret, buildJobID, ttl)
		if mintErr != nil {
			return build.BuildExecutionSpec{}, fmt.Errorf("resolver: minting worker token: %w", mintErr)
		}
	} else {
		// In dev/test when secret is too short or omitted, fallback or warn
		r.logger.Warn("resolver: worker JWT secret is less than 32 bytes; using placeholder token")
		token = "dev-worker-token-placeholder"
	}

	secretName := fmt.Sprintf("summit-build-%s", strings.ToLower(buildJobID.String()))

	// Create or update per-build Secret in summit-builds (contract C4)
	if r.kubeClient != nil {
		sec := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: r.cfg.BuildNamespace,
				Labels: map[string]string{
					"summit.dev/build-id": buildJobID.String(),
				},
			},
			Type: corev1.SecretTypeOpaque,
			Data: map[string][]byte{
				"token": []byte(token),
			},
		}
		_, err := r.kubeClient.CoreV1().Secrets(r.cfg.BuildNamespace).Create(ctx, sec, metav1.CreateOptions{})
		if apierrors.IsAlreadyExists(err) {
			_, err = r.kubeClient.CoreV1().Secrets(r.cfg.BuildNamespace).Update(ctx, sec, metav1.UpdateOptions{})
		}
		if err != nil {
			return build.BuildExecutionSpec{}, fmt.Errorf("resolver: provisioning build secret: %w", err)
		}
	}

	repoOwner, _, _ := strings.Cut(event.Repository.FullName, "/")
	builder := "railpack"
	if bCtx.DockerfilePath != nil && strings.TrimSpace(*bCtx.DockerfilePath) != "" {
		builder = "dockerfile"
	}

	bConfig := build.BuildConfig{
		Builder:        builder,
		DockerfilePath: bCtx.DockerfilePath,
	}
	if len(bCtx.BuildConfiguration) > 0 {
		_ = json.Unmarshal(bCtx.BuildConfiguration, &bConfig)
		if bConfig.Builder == "" {
			bConfig.Builder = builder
		}
		if bConfig.DockerfilePath == nil {
			bConfig.DockerfilePath = bCtx.DockerfilePath
		}
	}

	rootDir := bCtx.RootDirectory
	if strings.TrimSpace(rootDir) == "" {
		rootDir = "/"
	}

	cloneURL := bCtx.CloneURL
	if strings.TrimSpace(cloneURL) == "" {
		cloneURL = fmt.Sprintf("https://github.com/%s.git", event.Repository.FullName)
	}

	reportingEndpoint := fmt.Sprintf("%s/internal/v1/builds", strings.TrimRight(r.cfg.APIInternalURL, "/"))

	spec := build.BuildExecutionSpec{
		SchemaVersion: 1,
		Build: build.BuildMetadata{
			ID:            buildJobID.String(),
			AttemptID:     buildJobID.String(),
			AttemptNumber: 1,
			CorrelationID: event.EventID,
		},
		Source: build.SourceSpec{
			Provider:      "github",
			Repository:    event.Repository.FullName,
			CloneURL:      cloneURL,
			Branch:        event.Source.Branch,
			CommitSHA:     event.Source.CommitSHA,
			RootDirectory: rootDir,
		},
		BuildConfig: bConfig,
		Credentials: build.CredentialsSpec{
			SourceCredentialRef:   fmt.Sprintf("secret:%s", secretName),
			RegistryCredentialRef: fmt.Sprintf("secret:%s", r.cfg.GHCRPushSecret),
		},
		Output: build.OutputSpec{
			Registry:   "ghcr.io",
			Repository: fmt.Sprintf("%s/summit-app-%s", strings.ToLower(repoOwner), strings.ToLower(event.ServiceID)),
			Tag:        fmt.Sprintf("sha-%s", strings.ToLower(event.Source.CommitSHA)),
			Platforms:  []string{"linux/amd64"},
		},
		// Builds get fixed builder-sized limits. The service's runtime limits (often 0.5 CPU /
		// 512Mi) are far too small for buildkitd plus a Node/Python toolchain and dependency install.
		Resources: build.ResourceLimits{
			CPUMillicores:       builderCPUMillicores,
			MemoryMiB:           builderMemoryMiB,
			EphemeralStorageMiB: builderEphemeralStorageMiB,
		},
		TimeoutSeconds: timeoutSec,
		Reporting: build.ReportingSpec{
			Endpoint: reportingEndpoint,
			TokenRef: fmt.Sprintf("secret:%s", secretName),
		},
	}

	if err := spec.Validate(); err != nil {
		return build.BuildExecutionSpec{}, fmt.Errorf("resolver: produced invalid spec: %w", err)
	}

	return spec, nil
}
