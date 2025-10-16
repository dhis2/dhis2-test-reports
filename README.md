# DHIS2 Test Reports

Repository of automated test results with a web-based viewer.

## Features

- **Dynamic Report Discovery**: Automatically discovers test reports in the directory structure
- **Interactive Navigation**: Tree-based navigation with URL routing for permalinks
- **Version-Level Analytics**: Stacked area charts showing test statistics over time for each backend
- **Backend Comparison**: Side-by-side comparison of different backends (Doris vs PostgreSQL)
- **Detailed Test Analysis**: View individual test cases with pass/fail status and performance deltas
- **Error Inspection**: Modal-based error viewing with syntax highlighting and navigation

## Directory Structure

Reports are organized as:
```
reports/
├── manifest.json          # Auto-generated index of summary files
└── {component}/
    └── {test-type}/
        └── {version}/
            ├── summary.json           # Contains build information and metrics
            └── {build-date}_{hash}/   # Build directories (referenced in summary.json)
                ├── doris.json
                └── postgres.json
```

The `manifest.json` file is automatically generated and contains only the locations of `summary.json` files. Each `summary.json` file contains the detailed information about all builds for that version, including which backend files are available.

## Usage

### Viewing Reports

1. Open `reports/index.html` in a web browser
2. Navigate through the tree structure on the left
3. Click on a version to see analytics graphs showing test statistics over time
4. Use "View Individual Builds" to see specific build comparisons
5. Click "Details" to view individual test cases
6. Click on failed test cases to see error details

### Adding New Reports

1. Add your report files to the appropriate directory structure
2. Run `./update-manifest.sh` to regenerate the manifest
3. Commit and push the changes

### GitHub Pages Deployment

The repository includes a GitHub Actions workflow that automatically:
- Regenerates the manifest when reports are updated
- Commits the updated manifest back to the repository
- Enables GitHub Pages to serve the reports

## Development

### Regenerating the Manifest

```bash
# Using the convenience script
./update-manifest.sh

# Or directly with Python
python3 scripts/generate-manifest.py
```

### Local Development

1. Serve the reports directory with a local web server:
   ```bash
   cd reports
   python3 -m http.server 8000
   ```
2. Open http://localhost:8000 in your browser

## File Formats

- **summary.json**: Contains high-level metrics and comparison data
- **doris.json/postgres.json**: Contains detailed test case results with error information
