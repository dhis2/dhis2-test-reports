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
    this.currentFilter = 'all';
    this.currentSort = { column: null, direction: 'asc' };
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeNavigation();
  }

  initializeElements() {
    this.navContent = document.getElementById('nav-content');
    this.summaryTitle = document.getElementById('summaryTitle');
    this.summaryMeta = document.getElementById('summaryMeta');
    this.summaryContent = document.getElementById('summaryContent');
    this.errorModal = null;
    this.modalErrorContent = null;
    this.modalTitle = null;
    this.prevErrorBtn = null;
    this.nextErrorBtn = null;
    this.closeModalBtn = null;
    this.errorRows = [];
    this.currentErrorIndex = -1;
    this._modalKeyHandler = null;
  }

  setupEventListeners() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      this.handleURLChange();
    });
  }

  async initializeNavigation() {
    try {
      // Fetch the manifest file that contains the report structure
      const response = await fetch('manifest.json');
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      const structure = await response.json();

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

  async selectTestType(component, testType, versions) {
    // Remove active class from all items
    document.querySelectorAll('.test-type-item, .version-item, .build-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to selected test type
    const testTypeItem = document.querySelector(`[data-component="${component}"][data-test-type="${testType}"]`);
    testTypeItem.classList.add('active');
    
    // Show versions for this test type
    await this.showVersions(component, testType, versions);
    
    // Update URL
    this.updateURL(component, testType, null, null);
  }

  async showVersions(component, testType, versions) {
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
    
    // Load summary.json for each version to get build information
    for (const [version, versionData] of Object.entries(versions)) {
      if (versionData.summary) {
        try {
          const summaryPath = `${component}/${testType}/${version}/${versionData.summary}`;
          const response = await fetch(summaryPath);
          if (response.ok) {
            const summary = await response.json();
            const builds = summary.builds || {};
            
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
          }
        } catch (error) {
          console.error(`Error loading summary for ${component}/${testType}/${version}:`, error);
        }
      }
    }
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
    
    // Sort builds by build time (newest first)
    const sortedBuilds = Object.entries(builds).sort(([,a], [,b]) => {
      return new Date(b.buildTime) - new Date(a.buildTime);
    });
    
    sortedBuilds.forEach(([buildKey, buildData]) => {
      const buildItem = document.createElement('li');
      buildItem.className = 'build-item';
      buildItem.dataset.component = component;
      buildItem.dataset.testType = testType;
      buildItem.dataset.version = version;
      buildItem.dataset.build = buildKey;
      
      // Format build display using data from summary.json
      const date = new Date(buildData.buildTime);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      
      buildItem.innerHTML = `
        <div>${dateStr} ${timeStr}</div>
        <small>rev ${buildData.revision}</small>
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
    const headers = dbTypeKeys.map(name => `
      <th>
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <span>${name}</span>
          <button class="details-button" data-backend="${name}" data-build="${buildKey}">
            <svg class="details-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
              <line x1="14.5" y1="14.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Details
          </button>
        </span>
      </th>
    `).join('');
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
            <div class="filter-controls">
              <span class="filter-label">Filter by status:</span>
              <select class="filter-select" id="statusFilter">
                <option value="all">All</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>
            <div id="testCasesTable"></div>
          </div>
          <div class="error-panel-container"></div>
        </div>
      </div>
      <div class="modal-overlay" id="errorModal">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="modalTitle">Error Details</div>
            <div class="modal-actions">
              <button class="modal-button" id="prevError">Prev</button>
              <button class="modal-button" id="nextError">Next</button>
              <button class="modal-close" id="closeModal">✕</button>
            </div>
          </div>
          <div class="modal-body">
            <div class="error-content-modal" id="modalErrorContent"></div>
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
    
    // Track current backend/build and load details
    this.currentBackendType = backendType;
    this.currentBuildKey = buildKey;
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

      // Attempt to load counterpart backend for delta calculations
      const counterpart = backendType === 'doris' ? 'postgres' : 'doris';
      this.currentCounterpartData = null;
      try {
        const otherResp = await fetch(`./${this.currentPath.component}/${this.currentPath.testType}/${this.currentPath.version}/${buildKey}/${counterpart}.json`);
        if (otherResp.ok) {
          this.currentCounterpartData = await otherResp.json();
        }
      } catch (_) { /* ignore */ }

      this.displayBackendDetails(backendData);
    } catch (error) {
      console.error('Error loading backend details:', error);
      document.getElementById('testCasesTable').innerHTML = `<div class="error">Failed to load ${backendType} details: ${error.message}</div>`;
    }
  }

  displayBackendDetails(backendData) {
    this.currentBackendData = backendData;
    this.renderTestCasesTable();
    this.setupTableEventListeners();
  }

  renderTestCasesTable() {
    const results = this.currentBackendData.results;
    const testSuites = Object.entries(results);
    
    // Collect all test cases
    let allTestCases = [];
    testSuites.forEach(([suiteName, suiteData]) => {
      if (suiteData.testcases) {
        suiteData.testcases.forEach(testCase => {
          // compute delta vs counterpart if available
          let delta = null;
          if (this.currentCounterpartData && this.currentCounterpartData.results && this.currentCounterpartData.results[suiteName]) {
            const otherSuite = this.currentCounterpartData.results[suiteName];
            const otherCase = Array.isArray(otherSuite.testcases) ? otherSuite.testcases.find(tc => tc.name === testCase.name) : null;
            if (otherCase && typeof testCase.time === 'number' && typeof otherCase.time === 'number') {
              delta = Number(testCase.time) - Number(otherCase.time);
            }
          }

          allTestCases.push({
            suiteName,
            testCase,
            suiteDisplay: suiteName.split('.').pop(),
            status: testCase.failure ? 'FAIL' : 'PASS',
            statusClass: testCase.failure ? 'status-fail' : 'status-pass',
            rowClass: testCase.failure ? 'test-case-row failed' : 'test-case-row',
            time: (typeof testCase.time === 'number') ? Number(testCase.time) : null,
            delta
          });
        });
      }
    });

    // Apply filter
    let filteredTestCases = allTestCases;
    if (this.currentFilter === 'pass') {
      filteredTestCases = allTestCases.filter(tc => tc.status === 'PASS');
    } else if (this.currentFilter === 'fail') {
      filteredTestCases = allTestCases.filter(tc => tc.status === 'FAIL');
    }

    // Apply sorting
    if (this.currentSort.column) {
      filteredTestCases.sort((a, b) => {
        let aVal, bVal;
        switch (this.currentSort.column) {
          case 'suite':
            aVal = a.suiteDisplay;
            bVal = b.suiteDisplay;
            break;
          case 'test':
            aVal = a.testCase.name;
            bVal = b.testCase.name;
            break;
          case 'status':
            aVal = a.status;
            bVal = b.status;
            break;
          case 'time':
            aVal = (a.time !== null) ? a.time : Number.POSITIVE_INFINITY;
            bVal = (b.time !== null) ? b.time : Number.POSITIVE_INFINITY;
            break;
          case 'delta':
            aVal = (a.delta !== null) ? a.delta : Number.POSITIVE_INFINITY;
            bVal = (b.delta !== null) ? b.delta : Number.POSITIVE_INFINITY;
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return this.currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.currentSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const counterpartName = this.currentBackendType === 'doris' ? 'postgres' : (this.currentBackendType === 'postgres' ? 'doris' : 'counterpart');
    let html = `
      <table class="test-cases-table">
        <thead>
          <tr>
            <th class="sortable" data-column="suite">Test Suite</th>
            <th class="sortable" data-column="test">Test Case</th>
            <th class="sortable" data-column="status">Status</th>
            <th class="sortable" data-column="time">Time (s)</th>
            <th class="sortable" data-column="delta">Delta (vs. ${counterpartName})</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    filteredTestCases.forEach(({ suiteName, testCase, suiteDisplay, status, statusClass, rowClass, time, delta }) => {
      const timeDisplay = (time !== null) ? time.toFixed(3) : 'N/A';
      const deltaDisplay = (delta === null) ? '' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(3)}`;
      const deltaClass = (delta === null) ? '' : (delta >= 0 ? 'delta-positive' : 'delta-negative');
      html += `
        <tr class="${rowClass}" data-suite="${suiteName}" data-test="${testCase.name}" data-failure="${testCase.failure ? 'true' : 'false'}">
          <td>${suiteDisplay}</td>
          <td>${testCase.name}</td>
          <td class="${statusClass}">${status}</td>
          <td>${timeDisplay}</td>
          <td class="${deltaClass}">${deltaDisplay}</td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    document.getElementById('testCasesTable').innerHTML = html;
  }

  setupTableEventListeners() {
    // Add event listeners for test case rows
    const rows = Array.from(document.querySelectorAll('.test-case-row'));
    this.errorRows = rows.filter(r => r.dataset.failure === 'true');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        const suiteName = row.dataset.suite;
        const testName = row.dataset.test;
        
        // On click: if failed, open modal with error; if passed, do nothing
        const testCase = this.findTestCase(suiteName, testName);
        if (testCase && testCase.failure) {
          // set current index among error rows
          this.currentErrorIndex = this.errorRows.findIndex(r => r.dataset.suite === suiteName && r.dataset.test === testName);
          this.openErrorModal(suiteName, testName, testCase.failure);
        }
      });
    });

    // Add event listeners for column headers
    document.querySelectorAll('.sortable').forEach(header => {
      header.addEventListener('click', () => {
        const column = header.dataset.column;
        
        // Update sort direction
        if (this.currentSort.column === column) {
          this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          this.currentSort.column = column;
          this.currentSort.direction = 'asc';
        }
        
        // Update header classes
        document.querySelectorAll('.sortable').forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
        });
        header.classList.add(`sort-${this.currentSort.direction}`);
        
        // Re-render table
        this.renderTestCasesTable();
        this.setupTableEventListeners();
      });
    });

    // Add event listener for filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.renderTestCasesTable();
        this.setupTableEventListeners();
      });
    }

    // Modal controls wiring
    this.errorModal = document.getElementById('errorModal');
    this.modalErrorContent = document.getElementById('modalErrorContent');
    this.modalTitle = document.getElementById('modalTitle');
    this.prevErrorBtn = document.getElementById('prevError');
    this.nextErrorBtn = document.getElementById('nextError');
    this.closeModalBtn = document.getElementById('closeModal');
    if (this.prevErrorBtn) this.prevErrorBtn.onclick = () => this.navigateError(-1);
    if (this.nextErrorBtn) this.nextErrorBtn.onclick = () => this.navigateError(1);
    if (this.closeModalBtn) this.closeModalBtn.onclick = () => this.closeErrorModal();
    if (this.errorModal) {
      this.errorModal.addEventListener('click', (e) => {
        if (e.target === this.errorModal) this.closeErrorModal();
      });
    }
  }

  openErrorModal(suiteName, testName, failure) {
    if (!this.errorModal) return;
    this.errorModal.classList.add('active');
    this.updateModalContent(suiteName, testName, failure);
    // add keyboard navigation
    this._modalKeyHandler = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigateError(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateError(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeErrorModal();
      }
    };
    window.addEventListener('keydown', this._modalKeyHandler);
  }

  closeErrorModal() {
    if (this.errorModal) this.errorModal.classList.remove('active');
    if (this._modalKeyHandler) {
      window.removeEventListener('keydown', this._modalKeyHandler);
      this._modalKeyHandler = null;
    }
  }

  navigateError(direction) {
    if (!this.errorRows.length) return;
    this.currentErrorIndex = (this.currentErrorIndex + direction + this.errorRows.length) % this.errorRows.length;
    const row = this.errorRows[this.currentErrorIndex];
    const suiteName = row.dataset.suite;
    const testName = row.dataset.test;
    const tc = this.findTestCase(suiteName, testName);
    if (tc && tc.failure) this.updateModalContent(suiteName, testName, tc.failure);
  }

  updateModalContent(suiteName, testName, failure) {
    if (!failure) return;
    const title = `Error Details: ${suiteName.split('.').pop()} • ${testName}`;
    if (this.modalTitle) this.modalTitle.textContent = title;
    const details = [
      `Type: ${failure.type || ''}`,
      `Message: ${failure.message || ''}`,
      '',
      (failure.text || '')
    ].join('\n');
    if (this.modalErrorContent) {
      this.modalErrorContent.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'code-block';
      const code = document.createElement('code');
      // Force consistent highlighting using ReasonML syntax
      code.className = 'reasonml';
      code.textContent = details;
      pre.appendChild(code);
      this.modalErrorContent.appendChild(pre);
      if (window.hljs && typeof window.hljs.highlightElement === 'function') {
        window.hljs.highlightElement(code);
      }
    }
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
