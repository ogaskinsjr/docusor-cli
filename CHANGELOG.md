# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-27

### Added
- License field (`Apache-2.0`) to package.json for proper npm registry declaration

### Changed
- Updated package.json to include license metadata
- Removed unnecessary dependencies

## [0.1.0] - 2026-04-21

### Added
- Initial release of DocuSOR CLI
- Executable documentation verification system
- Command execution from fenced bash blocks in markdown
- Built-in assertions: `httpOk`, `httpStatus`, `portOpen`, `fileExists`, `logContains`, `commandSucceeds`
- Built-in waits: `waitFor` directives with timeout support
- Docker Compose auto-detection and orchestration
- Markdown and JSON report generation
- GitHub Actions CI workflow integration
- CLI interface with help and command support
- Apache-2.0 open-source license

### Features
- Runs bash code blocks directly from README.md or any markdown file
- Auto-detects and manages Docker Compose services
- Generates human-readable (DOCUSOR_REPORT.md) and machine-readable (docusor-report.json) reports
- Supports multiple assertion types for validation
- Proper exit codes for CI integration (0 = pass, 1 = failure, 2 = fatal error)

### Known Limitations
- Stops on first failure (continue-on-fail mode planned)
- Commands run in local environment or containers as-is
