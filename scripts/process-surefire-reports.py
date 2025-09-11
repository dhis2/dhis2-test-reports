#!/usr/bin/env python3

import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
import re
import argparse

def slugify(text):
    """Convert a string to a filesystem-safe slug"""
    text = str(text).lower().strip()
    # Replace spaces with dashes
    text = re.sub(r'\s+', '-', text)
    # Remove all non-word characters except dashes
    text = re.sub(r'[^\w\-]+', '', text)
    # Replace multiple dashes with single dash
    text = re.sub(r'\-\-+', '-', text)
    # Remove dashes from start and end
    text = text.strip('-')
    return text

def parse_test_result_xml(xml_content):
    """Parse XML test result file and convert to JSON structure"""
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML content: {e}")
    
    if root.tag != 'testsuite':
        raise ValueError('Invalid test result XML: no testsuite element found')
    
    result = {
        'name': root.get('name', ''),
        'time': float(root.get('time', 0)),
        'tests': int(root.get('tests', 0)),
        'errors': int(root.get('errors', 0)),
        'skipped': int(root.get('skipped', 0)),
        'failures': int(root.get('failures', 0)),
        'properties': {},
        'testcases': []
    }
    
    # Parse properties
    properties_elem = root.find('properties')
    if properties_elem is not None:
        for prop in properties_elem.findall('property'):
            name = prop.get('name')
            value = prop.get('value')
            if name:
                result['properties'][name] = value
    
    # Parse test cases
    for testcase in root.findall('testcase'):
        tc_result = {
            'name': testcase.get('name', ''),
            'classname': testcase.get('classname', ''),
            'time': float(testcase.get('time', 0))
        }
        
        # Check for failures, errors, or skipped tests
        failure = testcase.find('failure')
        error = testcase.find('error')
        skipped = testcase.find('skipped')
        
        if failure is not None:
            tc_result['failure'] = {
                'message': failure.get('message', ''),
                'type': failure.get('type', ''),
                'text': failure.text or ''
            }
        
        if error is not None:
            tc_result['error'] = {
                'message': error.get('message', ''),
                'type': error.get('type', ''),
                'text': error.text or ''
            }
        
        if skipped is not None:
            tc_result['skipped'] = {
                'message': skipped.get('message', '')
            }
        
        result['testcases'].append(tc_result)
    
    return result

def format_build_time(build_time):
    """Format build time to be more human-readable"""
    if not build_time:
        return 'unknown'
    
    try:
        # Parse ISO date like "2025-09-02T08:10:26.000"
        from datetime import datetime
        
        # Handle different ISO formats
        if build_time.endswith('.000'):
            dt = datetime.fromisoformat(build_time.replace('.000', ''))
        else:
            dt = datetime.fromisoformat(build_time.replace('Z', '+00:00'))
        
        # Format as YYYY-MM-DD_HH-MM-SS
        return dt.strftime('%Y-%m-%d_%H-%M-%S')
        
    except (ValueError, AttributeError):
        return slugify(build_time)

def generate_output_path(system_info, db_type, output_dir='results'):
    """Generate output file path based on system info"""
    version = slugify(system_info.get('version', 'unknown'))
    build_time = format_build_time(system_info.get('buildTime', 'unknown'))
    revision = slugify(system_info.get('revision', 'unknown'))
    db_type_slug = slugify(db_type)
    
    return f"{output_dir}/{version}/{build_time}_{revision}/{db_type_slug}.json"

def update_summary_file(system_info, db_type, summary, output_dir='results'):
    """Update or create summary.json file for the version"""
    version = slugify(system_info.get('version', 'unknown'))
    build_time = format_build_time(system_info.get('buildTime', 'unknown'))
    revision = slugify(system_info.get('revision', 'unknown'))
    
    summary_path = f"{output_dir}/{version}/summary.json"
    summary_dir = os.path.dirname(summary_path)
    
    os.makedirs(summary_dir, exist_ok=True)
    
    summary_data = {
        'version': system_info.get('version'),
        'builds': {}
    }
    
    # Read existing summary if it exists
    try:
        if os.path.exists(summary_path):
            with open(summary_path, 'r', encoding='utf-8') as f:
                summary_data = json.load(f)
    except (json.JSONDecodeError, IOError):
        # File doesn't exist or is invalid, use default
        pass
    
    # Create build key
    build_key = f"{build_time}_{revision}"
    
    # Initialize build entry if it doesn't exist
    if build_key not in summary_data['builds']:
        summary_data['builds'][build_key] = {
            'buildTime': system_info.get('buildTime'),
            'revision': system_info.get('revision'),
            'dbTypes': {}
        }
    
    # Add or update the database type entry
    summary_data['builds'][build_key]['dbTypes'][db_type] = summary
    
    # Write updated summary
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary_data, f, indent=2, ensure_ascii=False)
    
    print(f"Updated summary file: {summary_path}")

def process_surefire_reports(reports_dir, db_type='postgres', output_dir='results'):
    """Main processing function"""
    try:
        print(f"Processing surefire reports from: {reports_dir}")
        print(f"Using database type: {db_type}")
        
        # Read system_info.json
        system_info_path = os.path.join(reports_dir, 'system_info.json')
        
        if not os.path.exists(system_info_path):
            raise FileNotFoundError(f"system_info.json not found at {system_info_path}")
        
        with open(system_info_path, 'r', encoding='utf-8') as f:
            system_info = json.load(f)
        
        print(f"System info loaded - Version: {system_info.get('version')}, "
              f"Build: {system_info.get('buildTime')}, "
              f"Revision: {system_info.get('revision')}")
        
        # Find all TEST-*.xml files
        reports_path = Path(reports_dir)
        xml_files = list(reports_path.glob('TEST-*.xml'))
        
        print(f"Found {len(xml_files)} test result files")
        
        # Process each XML file
        results = {}
        for xml_file in xml_files:
            try:
                with open(xml_file, 'r', encoding='utf-8') as f:
                    xml_content = f.read()
                
                test_result = parse_test_result_xml(xml_content)
                
                # Use the test suite name as the key (without TEST- prefix and .xml suffix)
                key = xml_file.stem.replace('TEST-', '')
                results[key] = test_result
                
                print(f"Processed: {xml_file.name} ({test_result['tests']} tests)")
                
            except Exception as e:
                print(f"Error processing {xml_file.name}: {e}", file=sys.stderr)
        
        # Create the consolidated JSON structure
        consolidated_result = {
            'system_info': system_info,
            'results': results
        }
        
        # Generate output path and ensure directory exists
        output_path = generate_output_path(system_info, db_type, output_dir)
        output_file_dir = os.path.dirname(output_path)
        
        os.makedirs(output_file_dir, exist_ok=True)
        
        # Write the consolidated JSON file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(consolidated_result, f, indent=2, ensure_ascii=False)
        
        print(f"\nConsolidated results written to: {output_path}")
        print(f"Total test suites: {len(results)}")
        
        # Calculate summary statistics
        total_tests = sum(suite['tests'] for suite in results.values())
        total_errors = sum(suite['errors'] for suite in results.values())
        total_failures = sum(suite['failures'] for suite in results.values())
        total_skipped = sum(suite['skipped'] for suite in results.values())
        total_time = sum(suite['time'] for suite in results.values())
        
        print(f"Total tests: {total_tests}")
        print(f"Total errors: {total_errors}")
        print(f"Total failures: {total_failures}")
        print(f"Total skipped: {total_skipped}")
        
        # Update summary.json for this version
        from datetime import datetime
        update_summary_file(system_info, db_type, {
            'testSuites': len(results),
            'totalTests': total_tests,
            'totalErrors': total_errors,
            'totalFailures': total_failures,
            'totalSkipped': total_skipped,
            'totalTime': total_time,
            'timestamp': datetime.now().isoformat(),
            'outputFile': os.path.basename(output_path)
        }, output_dir)
        
        return output_path
        
    except Exception as e:
        print(f"Error processing surefire reports: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        description='Process surefire test reports and convert to consolidated JSON',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  %(prog)s                    # Use default postgres db-type
  %(prog)s mysql              # Use mysql as db-type
  %(prog)s postgres --output-dir ./test-results
  %(prog)s oracle -o /tmp/results --reports-dir /path/to/reports
        '''
    )
    
    parser.add_argument(
        'db_type',
        nargs='?',
        default='postgres',
        help='Database type to use in output filename (default: postgres)'
    )
    
    parser.add_argument(
        '--reports-dir',
        default='surefire-reports',
        help='Directory containing surefire reports (default: surefire-reports)'
    )
    
    parser.add_argument(
        '--output-dir', '-o',
        default='results',
        help='Output directory for processed results (default: results)'
    )
    
    args = parser.parse_args()
    
    # Make reports_dir relative to script location if not absolute
    if not os.path.isabs(args.reports_dir):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        reports_dir = os.path.join(script_dir, args.reports_dir)
    else:
        reports_dir = args.reports_dir
    
    if not os.path.exists(reports_dir):
        print(f"Error: Reports directory not found: {reports_dir}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Using output directory: {args.output_dir}")
    
    output_path = process_surefire_reports(reports_dir, args.db_type, args.output_dir)
    print(f"\n✅ Processing complete! Output file: {output_path}")

if __name__ == '__main__':
    main()
