#!/bin/bash
# Simple script to regenerate the manifest file

echo "Regenerating report manifest..."
python3 scripts/generate-manifest.py

if [ $? -eq 0 ]; then
    echo "✅ Manifest updated successfully!"
    echo "📁 Generated: reports/manifest.json"
else
    echo "❌ Failed to generate manifest"
    exit 1
fi
