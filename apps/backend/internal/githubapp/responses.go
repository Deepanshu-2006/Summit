package githubapp

import "time"

// installationResponse is the JSON shape returned by GET /app/installations/{id}.
type installationResponse struct {
	ID      int64 `json:"id"`
	Account struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
		Type  string `json:"type"`
	} `json:"account"`
	RepositorySelection string            `json:"repository_selection"`
	Permissions         map[string]string `json:"permissions"`
	SuspendedAt         *time.Time        `json:"suspended_at"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
	HTMLURL             string            `json:"html_url"`
}

func (r *installationResponse) toInstallation() Installation {
	return Installation{
		ID:                  r.ID,
		AccountID:           r.Account.ID,
		AccountLogin:        r.Account.Login,
		AccountType:         r.Account.Type,
		RepositorySelection: r.RepositorySelection,
		Permissions:         r.Permissions,
		SuspendedAt:         r.SuspendedAt,
		CreatedAt:           r.CreatedAt,
		UpdatedAt:           r.UpdatedAt,
		HTMLURL:             r.HTMLURL,
	}
}

// installationTokenRequest is the request body for POST /app/installations/{id}/access_tokens.
type installationTokenRequest struct {
	RepositoryIDs []int64           `json:"repository_ids,omitempty"`
	Permissions   map[string]string `json:"permissions,omitempty"`
}

// installationTokenResponse is the JSON shape returned by POST /app/installations/{id}/access_tokens.
type installationTokenResponse struct {
	Token               string            `json:"token"`
	ExpiresAt           time.Time         `json:"expires_at"`
	Permissions         map[string]string `json:"permissions"`
	RepositorySelection string            `json:"repository_selection"`
}

// repositoryResponse is the JSON shape for a single repository.
type repositoryResponse struct {
	ID    int64 `json:"id"`
	Owner struct {
		Login string `json:"login"`
	} `json:"owner"`
	Name          string     `json:"name"`
	FullName      string     `json:"full_name"`
	DefaultBranch string     `json:"default_branch"`
	Private       bool       `json:"private"`
	Archived      bool       `json:"archived"`
	Disabled      bool       `json:"disabled"`
	HTMLURL       string     `json:"html_url"`
	PushedAt      *time.Time `json:"pushed_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (r *repositoryResponse) toRepository() Repository {
	return Repository{
		ID:            r.ID,
		OwnerLogin:    r.Owner.Login,
		Name:          r.Name,
		FullName:      r.FullName,
		DefaultBranch: r.DefaultBranch,
		Private:       r.Private,
		Archived:      r.Archived,
		Disabled:      r.Disabled,
		HTMLURL:       r.HTMLURL,
		PushedAt:      r.PushedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}

// repositoryListResponse is the JSON shape returned by GET /installation/repositories.
type repositoryListResponse struct {
	TotalCount   int                  `json:"total_count"`
	Repositories []repositoryResponse `json:"repositories"`
}

// commitResponse is the JSON shape returned by GET /repos/{owner}/{repo}/commits/{ref}.
type commitResponse struct {
	SHA    string `json:"sha"`
	Commit struct {
		Message string `json:"message"`
		Author  struct {
			Date time.Time `json:"date"`
		} `json:"author"`
	} `json:"commit"`
	Author struct {
		Login string `json:"login"`
	} `json:"author"`
}

func (r *commitResponse) toCommit(ref string) Commit {
	return Commit{
		SHA:         r.SHA,
		Ref:         ref,
		Message:     r.Commit.Message,
		AuthorLogin: r.Author.Login,
		CommitDate:  r.Commit.Author.Date,
	}
}
