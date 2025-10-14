class ReportViewer {
  constructor() {
    this.currentPath = {
      component: null,
      testType: null,
      version: null,
      build: null
    };
    this.summary = null;
    this.currentBackendData = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeNavigation();
  }

  initializeElements() {
    this.navContent = document.getElementById('nav-content');
    this.summaryTitle = document.getElementById('summaryTitle');
    this.summaryMeta = document.getElementById('summaryMeta');
    this.summaryContent = document.getElementById('summaryContent');
  }

  setupEventListeners() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      this.handleURLChange();
    });
  }

  async initializeNavigation() {
    try {
      // For now, hardcode the known structure
      // In a real implementation, you'd fetch from a directory listing API
      const structure = {
        'core': {
          'e2e-analytics': {
            '243-snapshot': {
              '2025-09-09_09-09-08_c281bd8': 'summary.json'
            }
          }
        }
      };

      this.renderNavigation(structure);
      
      // Check URL parameters for initial selection
      this.handleURLChange();
    } catch (error) {
      console.error('Error initializing navigation:', error);
      this.navContent.innerHTML = '<p>Error loading navigation structure</p>';
    }
  }

  renderNavigation(structure) {
    this.navContent.innerHTML = '';
    
    Object.entries(structure).forEach(([component, testTypes]) => {
      const componentGroup = document.createElement('div');
      componentGroup.className = 'component-group';
      
      const componentTitle = document.createElement('div');
      componentTitle.className = 'component-title';
      componentTitle.innerHTML = `
        <span>${component.toUpperCase()}</span>
        <span class="expand-icon">▶</span>
      `;
      
      componentTitle.addEventListener('click', () => {
        const testTypeList = componentGroup.querySelector('.test-type-list');
        const isExpanded = testTypeList.classList.contains('expanded');
        
        // Toggle expansion
        testTypeList.classList.toggle('expanded');
        componentTitle.querySelector('.expand-icon').classList.toggle('expanded', !isExpanded);
      });
      
      componentGroup.appendChild(componentTitle);
      
      const testTypeList = document.createElement('ul');
      testTypeList.className = 'test-type-list';
      
      Object.entries(testTypes).forEach(([testType, versions]) => {
        const testTypeItem = document.createElement('li');
        testTypeItem.className = 'test-type-item';
        testTypeItem.textContent = testType;
        testTypeItem.dataset.component = component;
        testTypeItem.dataset.testType = testType;
        
        testTypeItem.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectTestType(component, testType, versions);
        });
        
        testTypeList.appendChild(testTypeItem);
      });
      
      componentGroup.appendChild(testTypeList);
      this.navContent.appendChild(componentGroup);
    });
  }

  selectTestType(component, testType, versions) {
    // Remove active class from all items
    document.querySelectorAll('.test-type-item, .version-item, .build-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to selected test type
    const testTypeItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"]`);
    testTypeItem.classList.add('active');
    
    // Show versions for this test type
    this.showVersions(component, testType, versions);
    
    // Update URL
    this.updateURL(component, testType, null, null);
  }

  showVersions(component, testType, versions) {
    // Hide all version lists
    document.querySelectorAll('.version-list').forEach(list => {
      list.style.display = 'none';
    });
    
    // Find the test type item and add version list after it
    const testTypeItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"]`);
    let versionList = testTypeItem.parentNode.querySelector('.version-list');
    
    if (!versionList) {
      versionList = document.createElement('ul');
      versionList.className = 'version-list';
      testTypeItem.parentNode.appendChild(versionList);
    }
    
    versionList.innerHTML = '';
    versionList.style.display = 'block';
    
    Object.entries(versions).forEach(([version, builds]) => {
      const versionItem = document.createElement('li');
      versionItem.className = 'version-item';
      versionItem.textContent = version;
      versionItem.dataset.component = component;
      versionItem.dataset.testType = testType;
      versionItem.dataset.version = version;
      
      versionItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectVersion(component, testType, version, builds);
      });
      
      versionList.appendChild(versionItem);
    });
  }

  selectVersion(component, testType, version, builds) {
    // Remove active class from version and build items
    document.querySelectorAll('.version-item, .build-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to selected version
    const versionItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"][data-version="${version}"]`);
    versionItem.classList.add('active');
    
    // Show builds for this version
    this.showBuilds(component, testType, version, builds);
    
    // Update URL
    this.updateURL(component, testType, version, null);
  }

  showBuilds(component, testType, version, builds) {
    // Hide all build lists
    document.querySelectorAll('.build-list').forEach(list => {
      list.style.display = 'none';
    });
    
    // Find the version item and add build list after it
    const versionItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"][data-version="${version}"]`);
    let buildList = versionItem.parentNode.querySelector('.build-list');
    
    if (!buildList) {
      buildList = document.createElement('ul');
      buildList.className = 'build-list';
      versionItem.parentNode.appendChild(buildList);
    }
    
    buildList.innerHTML = '';
    buildList.style.display = 'block';
    
    Object.entries(builds).forEach(([buildKey, summaryFile]) => {
      const buildItem = document.createElement('li');
      buildItem.className = 'build-item';
      buildItem.dataset.component = component;
      buildItem.dataset.testType = testType;
      buildItem.dataset.version = version;
      buildItem.dataset.build = buildKey;
      
      // Format build display
      const build = { buildTime: buildKey.split('_')[0] + 'T' + buildKey.split('_')[1].replace(/-/g, ':'), revision: buildKey.split('_')[2] };
      const date = new Date(build.buildTime);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      
      buildItem.innerHTML = `
        <div>${dateStr} ${timeStr}</div>
        <small>rev ${build.revision}</small>
      `;
      
      buildItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectBuild(component, testType, version, buildKey);
      });
      
      buildList.appendChild(buildItem);
    });
  }

  async selectBuild(component, testType, version, build) {
    // Remove active class from build items
    document.querySelectorAll('.build-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to selected build
    const buildItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"][data-version="${version}"][data-build="${build}"]`);
    buildItem.classList.add('active');
    
    // Update URL
    this.updateURL(component, testType, version, build);
    
    // Load and display summary
    await this.loadSummary(component, testType, version);
  }

  async loadSummary(component, testType, version) {
    this.showLoading();
    
    try {
      const response = await fetch(`./${component}/${testType}/${version}/summary.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const summary = await response.json();
      this.summary = summary;
      this.displaySummary(component, testType, version, summary);
    } catch (error) {
      console.error('Error loading summary:', error);
      this.showError(`Failed to load summary: ${error.message}`);
    }
  }

  displaySummary(component, testType, version, summary) {
    // Determine which build to show and update the title to reflect build summary
    const builds = summary.builds;
    const buildKeys = Object.keys(builds);
    
    if (buildKeys.length > 0) {
      // Use the first build or the currently selected build
      const currentBuild = this.currentPath.build || buildKeys[0];
      const build = builds[currentBuild];
      // Format as YYYY-MM-DD HH:MM (24h) and include revision
      const date = new Date(build.buildTime);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      this.summaryTitle.textContent = `Build: ${dateStr} ${timeStr} • rev ${build.revision}`;
      this.summaryMeta.textContent = `${component} / ${testType} / ${version}`;
      this.renderBuild(currentBuild, build);
    } else {
      this.summaryContent.innerHTML = '<div class="loading">No builds found.</div>';
    }
  }

  renderBuild(buildKey, build) {
    const dbTypes = build.dbTypes;
    const dbTypeKeys = Object.keys(dbTypes);
    const headers = dbTypeKeys.map(name => `<th>${name} <button class="details-button" data-backend="${name}" data-build="${buildKey}">Details</button></th>`).join('');
    const getSuccessRate = (d) => ((d.totalTests - d.totalErrors - d.totalFailures) / d.totalTests * 100).toFixed(1);
    const cell = (val, cls = '') => `<td class="${cls}">${val}</td>`;
    const cls = (n) => n > 0 ? 'bad' : 'ok';

    const row = (label, getter, classer) => {
      const cells = dbTypeKeys.map(k => {
        const d = dbTypes[k];
        const v = getter(d);
        const c = classer ? classer(v) : '';
        return cell(v, c);
      }).join('');
      return `<tr><th>${label}</th>${cells}</tr>`;
    };

    const detailsRow = () => {
      return ''; // No longer needed since buttons are in headers
    };

    const html = `
      <div class="summary-view">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${row('Test Suites', d => d.testSuites)}
            ${row('Total Tests', d => d.totalTests)}
            ${row('Errors', d => d.totalErrors, n => cls(n))}
            ${row('Failures', d => d.totalFailures, n => cls(n))}
            ${row('Skipped', d => d.totalSkipped, n => n > 0 ? 'warn' : '')}
            ${row('Success Rate', d => `${getSuccessRate(d)}%`, v => parseFloat(v) < 100 ? 'warn' : 'ok')}
            ${row('Total Time (s)', d => d.totalTime.toFixed(2))}
          </tbody>
        </table>
      </div>
      <div class="detail-view" id="detailView">
        <button class="back-button" id="backButton">← Back to Summary</button>
        <div class="detail-layout">
          <div class="test-cases-container">
            <div id="testCasesTable"></div>
          </div>
          <div class="error-panel-container">
            <div class="error-panel" id="errorPanel">
              <div class="error-panel-header">Error Details</div>
              <div class="error-content" id="errorContent">Select a failed test case to view error details.</div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.summaryContent.innerHTML = html;
    
    // Add event listeners for the new elements
    this.setupDetailViewEventListeners();
  }

  setupDetailViewEventListeners() {
    // Add event listeners for details buttons
    document.querySelectorAll('.details-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const backend = e.target.dataset.backend;
        const build = e.target.dataset.build;
        this.showBackendDetails(backend, build);
      });
    });
    
    // Add event listener for back button
    const backButton = document.getElementById('backButton');
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.showSummaryView();
      });
    }
  }

  updateURL(component, testType, version, build) {
    const params = new URLSearchParams();
    if (component) params.set('component', component);
    if (testType) params.set('testType', testType);
    if (version) params.set('version', version);
    if (build) params.set('build', build);
    
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.pushState({}, '', newUrl);
    
    // Update current path
    this.currentPath = { component, testType, version, build };
  }

  handleURLChange() {
    const params = new URLSearchParams(window.location.search);
    const component = params.get('component');
    const testType = params.get('testType');
    const version = params.get('version');
    const build = params.get('build');
    
    if (component && testType) {
      // Find and click the test type to expand the tree
      const testTypeItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"]`);
      if (testTypeItem) {
        testTypeItem.click();
        
        // If version is specified, wait a bit and click it
        if (version) {
          setTimeout(() => {
            const versionItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"][data-version="${version}"]`);
            if (versionItem) {
              versionItem.click();
              
              // If build is specified, wait a bit and click it
              if (build) {
                setTimeout(() => {
                  const buildItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"][data-version="${version}"][data-build="${build}"]`);
                  if (buildItem) {
                    buildItem.click();
                  }
                }, 100);
              }
            }
          }, 100);
        }
      }
    }
  }

  showLoading() {
    this.summaryContent.innerHTML = '<div class="loading">Loading summary data...</div>';
  }

  showError(message) {
    this.summaryContent.innerHTML = `<div class="error">${message}</div>`;
  }

  showBackendDetails(backendType, buildKey) {
    // Hide summary view and show detail view
    document.querySelector('.summary-view').style.display = 'none';
    document.getElementById('detailView').classList.add('active');
    
    // Update header with build info and backend type
    const build = this.summary.builds[buildKey];
    const date = new Date(build.buildTime);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    this.summaryTitle.textContent = `Build: ${dateStr} ${timeStr} • rev ${build.revision} - ${backendType} Details`;
    this.summaryMeta.textContent = `${this.currentPath.component} / ${this.currentPath.testType} / ${this.currentPath.version}`;
    
    // Load and display backend details
    this.loadBackendDetails(backendType, buildKey);
  }

  showSummaryView() {
    // Hide detail view and show summary view
    document.getElementById('detailView').classList.remove('active');
    document.querySelector('.summary-view').style.display = 'block';
    
    // Reset header with build info as title
    const build = this.summary.builds[this.currentPath.build];
    const date = new Date(build.buildTime);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    this.summaryTitle.textContent = `Build: ${dateStr} ${timeStr} • rev ${build.revision}`;
    this.summaryMeta.textContent = `${this.currentPath.component} / ${this.currentPath.testType} / ${this.currentPath.version}`;
  }

  async loadBackendDetails(backendType, buildKey) {
    try {
      const response = await fetch(`./${this.currentPath.component}/${this.currentPath.testType}/${this.currentPath.version}/${buildKey}/${backendType}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const backendData = await response.json();
      this.currentBackendData = backendData;
      this.displayBackendDetails(backendData);
    } catch (error) {
      console.error('Error loading backend details:', error);
      document.getElementById('testCasesTable').innerHTML = `<div class="error">Failed to load ${backendType} details: ${error.message}</div>`;
    }
  }

  displayBackendDetails(backendData) {
    const results = backendData.results;
    const testSuites = Object.entries(results);
    
    let html = `
      <table class="test-cases-table">
        <thead>
          <tr>
            <th>Test Suite</th>
            <th>Test Case</th>
            <th>Status</th>
            <th>Time (s)</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    testSuites.forEach(([suiteName, suiteData]) => {
      if (suiteData.testcases) {
        suiteData.testcases.forEach(testCase => {
          const hasFailure = testCase.failure;
          const status = hasFailure ? 'FAIL' : 'PASS';
          const statusClass = hasFailure ? 'status-fail' : 'status-pass';
          const rowClass = hasFailure ? 'test-case-row failed' : 'test-case-row';
          
          html += `
            <tr class="${rowClass}" data-suite="${suiteName}" data-test="${testCase.name}" data-failure="${hasFailure ? 'true' : 'false'}">
              <td>${suiteName.split('.').pop()}</td>
              <td>${testCase.name}</td>
              <td class="${statusClass}">${status}</td>
              <td>${testCase.time ? testCase.time.toFixed(3) : 'N/A'}</td>
            </tr>
          `;
        });
      }
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    document.getElementById('testCasesTable').innerHTML = html;
    
    // Add event listeners for test case rows
    document.querySelectorAll('.test-case-row').forEach(row => {
      row.addEventListener('click', () => {
        const suiteName = row.dataset.suite;
        const testName = row.dataset.test;
        const hasFailure = row.dataset.failure === 'true';
        
        // Find the actual test case data to get failure details
        const testCase = this.findTestCase(suiteName, testName);
        this.showTestError(suiteName, testName, testCase ? testCase.failure : null);
      });
    });
  }

  findTestCase(suiteName, testName) {
    if (!this.currentBackendData || !this.currentBackendData.results) {
      return null;
    }
    
    const suite = this.currentBackendData.results[suiteName];
    if (!suite || !suite.testcases) {
      return null;
    }
    
    return suite.testcases.find(tc => tc.name === testName);
  }

  showTestError(suiteName, testName, failure) {
    const errorContent = document.getElementById('errorContent');
    
    if (!failure) {
      errorContent.textContent = 'This test case passed successfully.';
      return;
    }
    
    let errorText = `Test: ${testName}\n`;
    errorText += `Suite: ${suiteName}\n`;
    errorText += `Type: ${failure.type}\n`;
    errorText += `Message: ${failure.message}\n\n`;
    errorText += `Stack Trace:\n${failure.text}`;
    
    errorContent.textContent = errorText;
  }
}

// Initialize the report viewer when the page loads
let reportViewer;
document.addEventListener('DOMContentLoaded', () => {
  reportViewer = new ReportViewer();
});
