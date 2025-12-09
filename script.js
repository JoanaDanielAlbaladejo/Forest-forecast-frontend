/* =========================================================
   CONFIG
========================================================= */
const API_BASE_URL = 'https://forecasting-tree-cover-in-the-philippines.onrender.com/api';

/* =========================================================
   MOBILE MENU
========================================================= */
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');

menuToggle.addEventListener('click', () => {
    const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', (!isExpanded).toString());
    mobileMenu.hidden = isExpanded;
    menuToggle.classList.toggle('open');
});

document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.hidden = true;
        menuToggle.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
    });
});

/* =========================================================
   NAVIGATION ACTIVE LINK
========================================================= */
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.nav-link');

function updateActiveLink() {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (window.scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', updateActiveLink);
window.addEventListener('load', updateActiveLink);

/* =========================================================
   SMOOTH SCROLL
========================================================= */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    });
});

/* =========================================================
   API WRAPPER
========================================================= */
async function apiGet(endpoint) {
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`Error fetching ${endpoint}:`, err);
        return null;
    }
}

/* =========================================================
   GLOBAL DATA
========================================================= */
let globalData = {
    forecasts: [],
    comparison: [],
    drivers: [],
    regions: []
};

/* =========================================================
   INITIALIZER
========================================================= */
async function initializeData() {
    try {
        globalData.drivers = await apiGet('/drivers');
        globalData.forecasts = await apiGet('/forecasts');
        globalData.comparison = await apiGet('/comparison');

        globalData.regions = [...new Set(globalData.forecasts.map(f => f.Region))];
        globalData.regions.sort();

        populateRegionSelects();
        loadAccuracyTable(); 

        // Placeholder calls
        // loadDriverCoefficients();
        // loadDriverHistory();

        console.log('Data initialized successfully:', globalData);

    } catch (err) {
        showError('Loading data...');
    }
}

function populateRegionSelects() {
    const regionSelect = document.getElementById('region-select');
    const driverRegionSelect = document.getElementById('driver-region-select');
    const accuracyRegionSelect = document.getElementById('accuracy-region-select');

    // Build dropdown options
    const opts = globalData.regions
        .map(r => `<option value="${r}">${r}</option>`)
        .join("");

    /* -------------------------------
       FOREST COVER REGION SELECT
       ------------------------------- */
    if (regionSelect) {
        regionSelect.innerHTML = `<option value="">Select a region...</option>${opts}`;

        regionSelect.addEventListener("change", () => {
            runAnalysis(regionSelect.value);
        });
    }

    /* -------------------------------
       DRIVERS REGION SELECT
       ------------------------------- */
    if (driverRegionSelect) {
        driverRegionSelect.innerHTML = `<option value="">Select a region...</option>${opts}`;

        // Show blank driver cards at startup
        renderDriverCards("");

        // Update when user selects region
        driverRegionSelect.addEventListener("change", () => {
            renderDriverCards(driverRegionSelect.value);
        });
    }

    /* -------------------------------
       ACCURACY REGION SELECT
       ------------------------------- */
    if (accuracyRegionSelect) {
        // Only include "All Regions" if there is data to display
        const allOpts = `<option value="">All Regions</option>${opts}`;
        accuracyRegionSelect.innerHTML = allOpts;

        accuracyRegionSelect.addEventListener("change", () => {
            loadAccuracyTable(accuracyRegionSelect.value);
        });
    }
}


/* =========================================================
   RUN ANALYSIS FUNCTION (Forest Cover Section)
========================================================= */
function runAnalysis(region) {
    if (!region) {
        // Clear stats if no region selected
        document.getElementById('stat-area').innerText = 'N/A';
        document.getElementById('stat-area-label').innerText = 'No Data Available';
        document.getElementById('stat-forecast').innerText = 'N/A';
        document.getElementById('stat-mae').innerText = 'N/A';
        document.getElementById('stat-mape').innerText = 'N/A';
        
        const container = document.getElementById('chart-container');
        container.innerHTML = `<div class="chart-placeholder">
            <p>Select a region and run analysis to view visualization</p>
        </div>`;
        return;
    }

    // --- Get latest actual tree cover from comparison ---
    const regionData = globalData.comparison.filter(r => r.Region === region);
    const latestData = regionData.reduce((prev, curr) => (curr.Year > prev.Year ? curr : prev), { Year: 0 });

    document.getElementById('stat-area').innerText = latestData?.Actual?.toLocaleString() ?? 'N/A';
    document.getElementById('stat-area-label').innerText = `Tree cover in ${latestData?.Year ?? 'N/A'}`;

    // --- Forecast 2025 ---
    const forecast2025 = globalData.forecasts.find(f => f.Region === region && f.Year === 2025);
    document.getElementById('stat-forecast').innerText = forecast2025?.SARIMAX_Forecast?.toLocaleString() ?? 'N/A';

    // --- MAE & MAPE (average across years for this region) ---
    const maes = regionData.map(r => r.AE).filter(v => v != null);
    const mapes = regionData.map(r => r.APE).filter(v => v != null);
    const avgMAE = maes.length ? (maes.reduce((a,b)=>a+b,0)/maes.length) : null;
    const avgMAPE = mapes.length ? (mapes.reduce((a,b)=>a+b,0)/mapes.length) : null;

    // Convert MAE to percentage of latest tree cover
    const latestTreeCover = latestData?.Actual ?? 1; // avoid division by zero
    const avgMAEPercent = avgMAE !== null ? (avgMAE / latestTreeCover * 100) : null;

    document.getElementById('stat-mae').innerText = avgMAEPercent?.toFixed(2) + '%' ?? 'N/A';
    document.getElementById('stat-mape').innerText = avgMAPE?.toFixed(2) + '%' ?? 'N/A';


    // --- Render chart for active tab ---
    const activeTab = document.querySelector('.tab.active');
    if (activeTab.dataset.tab === 'forecast') {
        renderForecastChart(region);
    } else {
        renderComparisonChart(region);
    }

    // Setup tab switching logic
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const region = regionSelect.value;

            if (!region) {
                const container = document.getElementById('chart-container');
                container.innerHTML = `<div class="chart-placeholder">
                    <p>Select a region to view visualization</p>
                </div>`;
                return;
            }

            if (tab.dataset.tab === 'forecast') {
                renderForecastChart(region);
            } else {
                renderComparisonChart(region);
            }
        });
    });
}

const regionSelect = document.getElementById('region-select');
if (regionSelect) {
    regionSelect.addEventListener('change', () => {
        runAnalysis(regionSelect.value);
    });
}


/* =========================================================
   ERROR POPUP
========================================================= */
function showError(message) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 22px;
        background: rgba(89, 133, 92, 0.35);;
        color: white;
        font-size: 0.95rem;
        border-radius: 14px;
        z-index: 9999;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        border: 1px solid rgba(255,255,255,0.3);
    `;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

/* =========================================================
   FORECAST & COMPARISON CHARTS (Forest Cover Section)
========================================================= */

let chartInstance = null;

function renderForecastChart(region) {
    const data = globalData.forecasts.filter(f => f.Region === region);
    if (!data.length) return showError('No forecast data available.');

    renderChart(
        data.map(f => f.Year),
        [{
            label: 'SARIMAX Forecast',
            data: data.map(f => f.SARIMAX_Forecast),
            borderColor: '#59855C',
            backgroundColor: 'rgba(89,133,92,0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: true
        }]
    );
}

function renderComparisonChart(region) {
    const data = globalData.comparison.filter(c => c.Region === region);
    if (!data.length) return showError('No comparison data available.');

    renderChart(
        data.map(c => c.Year),
        [
            {
                label: 'Actual',
                data: data.map(c => c.Actual),
                borderColor: '#2fa44f',
                backgroundColor: 'rgba(47,164,79,0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            },
            {
                label: 'Forecast',
                data: data.map(c => c.SARIMAX_Forecast),
                borderColor: '#f0a84b',
                backgroundColor: 'rgba(240,168,75,0.1)',
                borderDash: [6, 4],
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }
        ]
    );
}

function renderChart(labels, datasets) {
    const container = document.getElementById('chart-container');
    container.innerHTML = `<canvas id="main-chart"></canvas>`;

    const ctx = document.getElementById('main-chart').getContext('2d');

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    ticks: { callback: v => v.toLocaleString() }
                }
            }
        }
    });
}

/* =========================================================
   DRIVER COEFFICIENTS PER REGION
========================================================= */
function renderDriverCards(region) {
    const container = document.getElementById('driver-cards');
    container.innerHTML = '';

    const driversList = ["Agriculture", "Logging", "Urbanization", "Roads"];

    const descriptions = {
        "Agriculture": "Harvested area in hectares – conversion of forest to cropland",
        "Logging": "Timber extraction impact",
        "Urbanization": "City expansion effects",
        "Roads": "Infrastructure development"
    };

    const emojiMap = {
        "Agriculture": "🌾",
        "Logging": "🪵",
        "Urbanization": "🏙️",
        "Roads": "🛣️"
    };

    // If NO region selected → show empty cards
    if (!region) {
        driversList.forEach(driver => {
            const card = document.createElement('div');
            card.className = "driver-box";

            // Corrected template for empty cards
            card.innerHTML = `
                <div class="driver-header">
                    <h3>${driver}</h3>
                    <div class="driver-icon">${emojiMap[driver]}</div>
                </div>

                <p class="driver-description">${descriptions[driver]}</p>

                <div class="driver-stats">
                    <div class="coef muted-text">Coefficient: —</div>
                    <div class="pval muted-text">P-value: —</div>
                </div>
            `;


            container.appendChild(card);
        });

        return;
    }

    // Region selected → Load actual data
    const drivers = globalData.drivers.filter(
        d => d.Region === region && d.Driver.toLowerCase() !== 'const'
    );

    driversList.forEach(driver => {
        // Check for both "Driver" and "Driver_km" in the API data
        const d = drivers.find(item => item.Driver === driver || item.Driver === driver + "_km");

        // Handle missing records
        const coefValue = d ? Number(d.Coefficient) : null;
        const pValue = d ? Number(d["P-value"]) : null;

        const coefColor =
            coefValue == null ? "var(--text-secondary)" :
            coefValue > 0 ? "green" : "red";

        const card = document.createElement('div');
        card.className = "driver-box";

        // Corrected template to use calculated values
        card.innerHTML = `
            <div class="driver-header">
                <h3>${driver}</h3>
                <div class="driver-icon">${emojiMap[driver]}</div>
            </div>

            <p class="driver-description">${descriptions[driver]}</p>

            <div class="driver-stats">
                <div class="coef" style="color:${coefColor}">
                    Coefficient: ${coefValue !== null ? coefValue.toFixed(4) : "—"}
                </div>

                <div class="pval">
                    P-value: ${pValue !== null ? pValue.toExponential(2) : "—"}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

/* =========================================================
   REGION SELECT EVENT (Drivers Section)
========================================================= */
const driverRegionSelect = document.getElementById('driver-region-select');
if (driverRegionSelect) {
    driverRegionSelect.addEventListener('change', () => {
        renderDriverCards(driverRegionSelect.value);
    });

}


/* =========================================================
   DRIVER HISTORY SECTION (fallback included - unused)
========================================================= */
const fallbackDriverData = {
    "Logging":[{year:2015,value:22},{year:2016,value:23},{year:2017,value:24},{year:2018,value:25},{year:2019,value:26},{year:2020,value:25},{year:2021,value:24},{year:2022,value:25},{year:2023,value:26},{year:2024,value:25}],
    "Agriculture":[{year:2015,value:38},{year:2016,value:39},{year:2017,value:39},{year:2018,value:40},{year:2019,value:41},{year:2020,value:40},{year:2021,value:39},{year:2022,value:40},{year:2023,value:41},{year:2024,value:40}],
    "Urbanization":[{year:2015,value:13},{year:2016,value:14},{year:2017,value:14},{year:2018,value:15},{year:2019,value:16},{year:2020,value:15},{year:2021,value:14},{year:2022,value:15},{year:2023,value:16},{year:2024,value:15}],
    "Mining":[{year:2015,value:9},{year:2016,value:9},{year:2017,value:10},{year:2018,value:10},{year:2019,value:11},{year:2020,value:10},{year:2021,value:9},{year:2022,value:10},{year:2023,value:11},{year:2024,value:10}]
};

function loadDriverHistory() {
    // This function is currently not fully implemented in the HTML structure
}
function renderDriverHistory(rows) {
    // This function is currently not fully implemented in the HTML structure
}
function loadDriverCoefficients() {
    // This function is currently unused, replaced by renderDriverCards
}

/* =========================================================
   ACCURACY TABLE AND CHART (Insights Section)
========================================================= */

/* =========================================================
   ACCURACY TABLE AND CHART (Insights Section)
========================================================= */

let accuracyChartInstance = null;

function renderAccuracyChart(data, filter) {
    const container = document.getElementById('accuracy-chart-container');
    const chartPlaceholder = container.querySelector('.chart-placeholder');
    const titleElement = container.querySelector('h3.card-title');

    // Filter data for the chart (excluding overall data)
    const chartData = data.filter(r => r.Region === filter);

    if (!filter || !chartData.length) {
        if (accuracyChartInstance) accuracyChartInstance.destroy();
        chartPlaceholder.style.display = 'flex';
        titleElement.textContent = "Forecast Error Trend (MAE/MAPE)";
        return;
    }

    // Hide placeholder and update title
    chartPlaceholder.style.display = 'none';
    titleElement.innerHTML = `<span class="title-text-wrapper">Forecast Error Trend for ${filter}</span>`;  

    // Destroy existing chart if it exists
    const ctx = document.getElementById('accuracy-chart').getContext('2d');
    if (accuracyChartInstance) accuracyChartInstance.destroy();

    // Use default light chart styling (no specific 'white' or 'dark' colors)
    accuracyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(r => r.Year),
            datasets: [
                {
                    label: 'Mean Absolute Error (MAE)',
                    data: chartData.map(r => r.AE),
                    borderColor: '#f0a84b', // Orange (Matches Forecast Comparison)
                    backgroundColor: 'rgba(240, 168, 75, 0.1)',
                    yAxisID: 'y1',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Mean Absolute % Error (MAPE)',
                    data: chartData.map(r => r.APE),
                    borderColor: '#2fa44f', // Green (Matches Actual Comparison)
                    backgroundColor: 'rgba(47, 164, 79, 0.1)',
                    yAxisID: 'y2',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            
            // ADJUSTED: Increase bottom padding to create margin and increase chart size
            layout: {
                padding: {
                    left: 0,
                    right: 0,
                    top: 1,
                    bottom: 0 // <-- Padding added here
                }
            },
            
            scales: {
                x: {
                    // Removed custom dark styling (reverts to default black/grey)
                    grid: { color: 'rgba(0, 0, 0, 0.2)' }, 
                    ticks: { color: 'black' } 
                },
                y1: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'MAE (Hectares)', color: 'black' }, // Reverted to black
                    ticks: { callback: v => v.toLocaleString(), color: 'black' }, // Reverted to black
                    grid: { color: 'rgba(0, 0, 0, 0.2)' } // Light grid lines
                },
                y2: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'MAPE (%)', color: 'black' }, // Reverted to black
                    ticks: { callback: v => v.toFixed(2) + '%', color: 'black' }, // Reverted to black
                    grid: { drawOnChartArea: false } 
                }
            },
            plugins: {
                legend: { labels: { color: 'black' } } // Reverted to black
            }
        }
    });
}

function loadAccuracyTable(filter = '') {
    const box = document.getElementById('accuracy-table-container').querySelector('.table-container');

    let data = globalData.comparison;
    
    // --- Render Chart (must run first, as it uses the 'filter' argument) ---
    renderAccuracyChart(globalData.comparison, filter);
    
    if (filter) data = data.filter(r => r.Region === filter);
    
    if (!data.length) {
        box.innerHTML = `<div class="chart-placeholder"><p>No data available</p></div>`;
        document.getElementById('overall-mae').innerText = 'N/A';
        document.getElementById('overall-mape').innerText = 'N/A';
        return;
    }

    let html = `
        <table class="accuracy-table">
        <thead>
            <tr>
                <th>Region</th>
                <th>Year</th>
                <th>Actual</th>
                <th>Forecast</th>
                <th>MAE</th>
                <th>MAPE</th>
            </tr>
        </thead><tbody>
    `;

    data.forEach(r => {
        html += `
            <tr>
                <td>${r.Region}</td>
                <td>${r.Year}</td>
                <td>${r.Actual.toLocaleString()}</td>
                <td>${r.SARIMAX_Forecast.toLocaleString()}</td>
                <td style="color:${r.AE > r.Actual * 0.05 ? 'red' : 'green'}">${r.AE.toLocaleString()}</td>
                <td style="color:${r.APE > 5 ? 'red' : 'green'}">${r.APE.toFixed(2)}%</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    box.innerHTML = html;

    // Update overall MAE & MAPE
    const avgMAE = data.reduce((sum, r) => sum + r.AE, 0) / data.length;
    const avgMAPE = data.reduce((sum, r) => sum + r.APE, 0) / data.length;

    document.getElementById('overall-mae').innerText = avgMAE.toFixed(2);
    document.getElementById('overall-mape').innerText = avgMAPE.toFixed(2) + '%';
}

// Populate dropdown options
const accuracyRegionSelect = document.getElementById('accuracy-region-select');
if (accuracyRegionSelect) {
    accuracyRegionSelect.addEventListener('change', () => {
        loadAccuracyTable(accuracyRegionSelect.value);
    });
}

// Auto-load all data on page load is handled by initializeData()

/* =========================================================
   FOOTER YEAR
========================================================= */
document.querySelector('#year').textContent = new Date().getFullYear();

/* =========================================================
   INIT APP
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    updateActiveLink();
    initializeData();
    console.log('ForestCastPH initialized');
});