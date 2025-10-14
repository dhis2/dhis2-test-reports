# Surefire Test Reports Processor

This script processes Maven Surefire test reports and consolidates them into a single JSON file.

## Overview

The script processes:
- `system_info.json` - System information file
- `TEST-*.xml` - Surefire XML test result files

And generates a consolidated JSON file with the structure:
```json
{
  "system_info": { ... },
  "results": {
    "test.class.name": {
      "name": "test.class.name",
      "time": 1.23,
      "tests": 10,
      "errors": 0,
      "failures": 0,
      "skipped": 1,
      "properties": { ... },
      "testcases": [ ... ]
    }
  }
}
```

## Output File Path

The output file path is generated from system_info attributes:
```
./results/<version>/<build-time>-<revision>/<db-type>.json
```

Where:
- `<version>` - slugified version from system_info.json
- `<build-time>` - slugified buildTime from system_info.json  
- `<revision>` - slugified revision from system_info.json
- `<db-type>` - database type (default: postgres)

All path components are slugified (lowercased, spaces to dashes, special chars removed).

## Available Scripts


### Python Version

**Requirements**: Python 3.6+

```bash
# Run with default postgres db-type
python3 process-surefire-reports.py

# Run with custom db-type
python3 process-surefire-reports.py mysql
python3 process-surefire-reports.py oracle

# Show help
python3 process-surefire-reports.py --help

# Custom reports directory
python3 process-surefire-reports.py --reports-dir /path/to/reports postgres
```


## Output Structure

### System Info Section
Contains the complete contents of `system_info.json`:
```json
{
  "system_info": {
    "version": "2.43-SNAPSHOT",
    "revision": "2f015f0", 
    "buildTime": "2025-09-02T08:10:26.000",
    ...
  }
}
```

### Results Section
Contains parsed test results from all `TEST-*.xml` files:
```json
{
  "results": {
    "org.example.TestClass": {
      "name": "org.example.TestClass",
      "time": 1.234,
      "tests": 5,
      "errors": 0,
      "failures": 0,
      "skipped": 0,
      "properties": {
        "java.version": "17",
        ...
      },
      "testcases": [
        {
          "name": "testMethod1",
          "classname": "org.example.TestClass",
          "time": 0.123
        },
        {
          "name": "testMethod2",
          "classname": "org.example.TestClass", 
          "time": 0.234,
          "failure": {
            "message": "Expected 5 but was 3",
            "type": "AssertionError",
            "text": "stack trace..."
          }
        }
      ]
    }
  }
}
```

## Features

- **Error handling**: Graceful handling of malformed XML files
- **Progress reporting**: Shows processing status for each file
- **Summary statistics**: Reports total tests, errors, failures, and skipped
- **Flexible output paths**: Supports custom database types
- **Safe file paths**: All path components are properly slugified

## File Structure

```
├── process-surefire-reports.py    # Python implementation  
├── surefire-reports/              # Input directory
│   ├── system_info.json          # System information
│   ├── TEST-*.xml                # Test result files
│   └── *.txt                     # Text logs (ignored)
└── results/                      # Output directory
    └── <version>/
        └── <build-time>-<revision>/
            ├── postgres.json
            ├── mysql.json
            └── oracle.json
```
