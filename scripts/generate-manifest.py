#!/usr/bin/env python3
"""
Generate a manifest.json file listing all available summary.json files for GitHub Pages.
This script scans the reports directory and creates a JSON file that the frontend can fetch.
The manifest only contains the locations of summary.json files - the summary files themselves
contain the detailed build information.
"""

import os
import json
from pathlib import Path

def scan_reports_directory(reports_dir):
    """Scan the reports directory and build a structure of available summary.json files.
    
    The manifest only contains the locations of summary.json files. Each summary.json
    file contains the detailed build information including which backend files are available.
    """
    structure = {}
    
    for root, dirs, files in os.walk(reports_dir):
        # Skip the root reports directory itself
        if root == reports_dir:
            continue
            
        # Check if this directory contains a summary.json
        if 'summary.json' in files:
            # Extract the path components relative to reports_dir
            rel_path = os.path.relpath(root, reports_dir)
            path_parts = rel_path.split(os.sep)
            
            # Build nested structure
            current = structure
            for part in path_parts:
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            # Add summary.json reference
            current['summary'] = 'summary.json'
    
    return structure

def main():
    reports_dir = Path(__file__).parent.parent / 'reports'
    manifest_path = reports_dir / 'manifest.json'
    
    print(f"Scanning reports directory: {reports_dir}")
    structure = scan_reports_directory(str(reports_dir))
    
    # Write manifest file
    with open(manifest_path, 'w') as f:
        json.dump(structure, f, indent=2)
    
    print(f"Generated manifest.json with {len(json.dumps(structure))} characters")
    print(f"Structure: {json.dumps(structure, indent=2)}")

if __name__ == '__main__':
    main()
