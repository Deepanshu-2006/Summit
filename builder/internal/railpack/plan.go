package railpack

// Plan captures the structured build plan output emitted by railpack prepare.
type Plan struct {
	SchemaVersion int              `json:"schema_version,omitempty"`
	Provider      string           `json:"provider,omitempty"`
	Runtime       RuntimeMetadata  `json:"runtime,omitempty"`
	Phases        map[string]Phase `json:"phases,omitempty"`
	StartCommand  string           `json:"start_command,omitempty"`
}

// RuntimeMetadata captures detected application runtime details.
type RuntimeMetadata struct {
	Language       string `json:"language,omitempty"`
	Version        string `json:"version,omitempty"`
	PackageManager string `json:"package_manager,omitempty"`
}

// Phase represents a distinct execution phase (e.g. setup, install, build).
type Phase struct {
	Commands []string `json:"commands,omitempty"`
}
