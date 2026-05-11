const WHEAT_TYPES = {
  softWhiteWheat: { label: "Soft White Wheat" },
  hardRedWheat: { label: "Hard Red Wheat" },
  durumWheat: { label: "Durum Wheat" }
};

const FORECAST_ICONS = {
  temperature: "🌡️",
  rainfall: "💧",
  windSpeed: "🌬️"
};

const HISTORY_COLORS = {
  primary: "#009E73",
  secondaryOne: "#0072B2",
  secondaryTwo: "#D55E00"
};

const HISTORICAL_METRICS = {
  rainfall: { label: "Rainfall", unit: "mm", formatter: (value) => `${value.toFixed(1)} mm`, mode: "single" },
  windSpeed: { label: "Wind Speed", unit: "km/h", formatter: (value) => `${value.toFixed(1)} km/h`, mode: "single" },
  temperature: { label: "Temperature", unit: "°C", formatter: (value) => `${value.toFixed(1)}°C`, mode: "paired" }
};

const TEMPERATURE_MODES = {
  both: { label: "Min & max temp" },
  min: { label: "Min temp" },
  max: { label: "Max temp" }
};

const STATION_COORDS = {
  "8297": { x: 96, y: 134 },
  "10092": { x: 125, y: 152 },
  "10111": { x: 132, y: 170 },
  "18083": { x: 161, y: 194 },
  "22050": { x: 190, y: 208 },
  "25509": { x: 226, y: 226 },
  "41100": { x: 311, y: 111 },
  "41522": { x: 314, y: 139 },
  "41529": { x: 311, y: 150 },
  "53115": { x: 300, y: 173 },
  "54038": { x: 307, y: 181 },
  "73142": { x: 283, y: 206 },
  "76047": { x: 255, y: 224 },
  "79100": { x: 266, y: 221 },
  "80128": { x: 274, y: 212 },
  "91311": { x: 280, y: 267 },
  "91375": { x: 279, y: 272 },
  "93036": { x: 286, y: 276 }
};

const forecastData = window.FORECAST_DATA;
const historicalData = window.HISTORICAL_DATA;
const mapData = window.MAP_DATA;
const stationList = Object.values(forecastData.stations)
  .sort((left, right) => {
  return left.state.localeCompare(right.state) || left.stationName.localeCompare(right.stationName);
});
const GLOBAL_HISTORY_PERIODS = buildMonthlyPeriods("2021-01", "2026-01");

const state = {
  forecastLocation: "",
  wheatType: "",
  selectedIndex: 0,
  firstForecastIndex: 0,
  historyMetric: "rainfall",
  temperatureMode: "both",
  compareStations: ["", ""],
  historyStart: "2021-01",
  historyEnd: "2026-01"
};

const elements = {
  forecastLocation: document.querySelector("#forecast-location"),
  cropSelect: document.querySelector("#crop-select"),
  outlookHeading: document.querySelector("#outlook-heading"),
  selectedDateLabel: document.querySelector("#selected-date-label"),
  dateSlider: document.querySelector("#date-slider"),
  rangeStart: document.querySelector("#range-start"),
  rangeEnd: document.querySelector("#range-end"),
  weeklyStats: document.querySelector("#weekly-stats"),
  recommendationText: document.querySelector("#recommendation-text"),
  stationMap: document.querySelector("#station-map"),
  mapLegend: document.querySelector("#map-legend"),
  mapDescription: document.querySelector("#map-description"),
  historyMetric: document.querySelector("#history-metric"),
  temperatureModeGroup: document.querySelector("#temperature-mode-group"),
  temperatureMode: document.querySelector("#temperature-mode"),
  historyStart: document.querySelector("#history-start"),
  historyEnd: document.querySelector("#history-end"),
  compareOne: document.querySelector("#compare-one"),
  compareTwo: document.querySelector("#compare-two"),
  historyDescription: document.querySelector("#history-description"),
  historyChart: document.querySelector("#history-chart"),
  hoverTooltip: document.querySelector("#hover-tooltip")
};

initialize();

function initialize() {
  populateForecastLocation();
  populateWheatTypes();
  populateHistoricalMetric();
  populateTemperatureModes();
  populateCompareLocations();
  setDefaultDateIndex();
  syncHistoryDateSelectors();
  bindEvents();
  render();
}

function populateForecastLocation() {
  elements.forecastLocation.innerHTML = [`<option value="">Select location</option>`]
    .concat(stationList.map((station) => `<option value="${station.stationNumber}">${station.stationName}, ${station.state}</option>`))
    .join("");
  elements.forecastLocation.value = state.forecastLocation;
}

function populateWheatTypes() {
  elements.cropSelect.innerHTML = [`<option value="">Select wheat type</option>`]
    .concat(Object.entries(WHEAT_TYPES).map(([key, crop]) => `<option value="${key}">${crop.label}</option>`))
    .join("");
  elements.cropSelect.value = state.wheatType;
}

function populateHistoricalMetric() {
  elements.historyMetric.innerHTML = Object.entries(HISTORICAL_METRICS)
    .map(([key, metric]) => `<option value="${key}">${metric.label}</option>`)
    .join("");
  elements.historyMetric.value = state.historyMetric;
}

function populateTemperatureModes() {
  elements.temperatureMode.innerHTML = Object.entries(TEMPERATURE_MODES)
    .map(([key, mode]) => `<option value="${key}">${mode.label}</option>`)
    .join("");
  elements.temperatureMode.value = state.temperatureMode;
}

function populateCompareLocations() {
  const options = [`<option value="">Select location</option>`]
    .concat(stationList.map((station) => `<option value="${station.stationNumber}">${station.stationName}, ${station.state}</option>`))
    .join("");

  [elements.compareOne, elements.compareTwo].forEach((select, index) => {
    select.innerHTML = options;
    select.value = state.compareStations[index];
  });
}

function bindEvents() {
  elements.forecastLocation.addEventListener("change", (event) => {
    state.forecastLocation = event.target.value;
    setDefaultDateIndex();
    syncHistoryDateSelectors();
    render();
  });

  elements.cropSelect.addEventListener("change", (event) => {
    state.wheatType = event.target.value;
    render();
  });

  elements.dateSlider.addEventListener("input", (event) => {
    state.selectedIndex = Number(event.target.value);
    render(false);
  });

  elements.historyMetric.addEventListener("change", (event) => {
    state.historyMetric = event.target.value;
    syncHistoryDateSelectors();
    render();
  });

  elements.temperatureMode.addEventListener("change", (event) => {
    state.temperatureMode = event.target.value;
    render();
  });

  elements.historyStart.addEventListener("change", (event) => {
    state.historyStart = event.target.value;
    if (periodIndex(state.historyStart) > periodIndex(state.historyEnd)) {
      state.historyEnd = state.historyStart;
      elements.historyEnd.value = state.historyEnd;
    }
    render();
  });

  elements.historyEnd.addEventListener("change", (event) => {
    state.historyEnd = event.target.value;
    if (periodIndex(state.historyEnd) < periodIndex(state.historyStart)) {
      state.historyStart = state.historyEnd;
      elements.historyStart.value = state.historyStart;
    }
    render();
  });

  [elements.compareOne, elements.compareTwo].forEach((select, index) => {
    select.addEventListener("change", (event) => {
      state.compareStations[index] = event.target.value;
      dedupeCompareStations(index);
      render();
    });
  });

  document.querySelectorAll(".page-nav a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) {
        return;
      }
      event.preventDefault();
      const target = document.querySelector(href);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function dedupeCompareStations(changedIndex) {
  const value = state.compareStations[changedIndex];
  if (!value) {
    syncCompareSelects();
    return;
  }

  state.compareStations = state.compareStations.map((current, index) => {
    if (index !== changedIndex && current === value) {
      return "";
    }
    return current;
  });

  if (value === state.forecastLocation) {
    state.compareStations[changedIndex] = "";
  }

  syncCompareSelects();
}

function syncCompareSelects() {
  [elements.compareOne, elements.compareTwo].forEach((select, index) => {
    select.value = state.compareStations[index];
  });
}

function setDefaultDateIndex() {
  const station = getForecastStation();
  if (!station) {
    state.firstForecastIndex = 0;
    state.selectedIndex = 0;
    elements.dateSlider.min = "0";
    elements.dateSlider.max = "0";
    elements.dateSlider.value = "0";
    elements.dateSlider.disabled = true;
    return;
  }

  const today = toLocalDateString(new Date());
  const currentIndex = station.series.findIndex((entry) => entry.date === today);
  const maxStartIndex = Math.max(0, station.series.length - 7);

  state.firstForecastIndex = currentIndex >= 0 ? currentIndex : 0;
  state.selectedIndex = state.firstForecastIndex;

  elements.dateSlider.min = String(state.firstForecastIndex);
  elements.dateSlider.max = String(maxStartIndex);
  elements.dateSlider.value = String(state.selectedIndex);
  elements.dateSlider.disabled = false;
}

function syncHistoryDateSelectors() {
  const periods = getMetricPeriods(state.historyMetric);
  const optionsMarkup = periods
    .map((period) => `<option value="${period}">${formatPeriodLabel(period)}</option>`)
    .join("");

  elements.historyStart.innerHTML = optionsMarkup;
  elements.historyEnd.innerHTML = optionsMarkup;

  if (!state.historyStart || !periods.includes(state.historyStart)) {
    state.historyStart = periods[0];
  }
  if (!state.historyEnd || !periods.includes(state.historyEnd)) {
    state.historyEnd = periods[periods.length - 1];
  }
  if (periodIndex(state.historyStart) > periodIndex(state.historyEnd)) {
    state.historyStart = periods[0];
    state.historyEnd = periods[periods.length - 1];
  }

  elements.historyStart.value = state.historyStart;
  elements.historyEnd.value = state.historyEnd;
}

function render(updateForecastSlider = true) {
  renderWeeklyOutlook(updateForecastSlider);
  renderMap();
  renderHistoricalComparison();
}

function renderWeeklyOutlook(updateForecastSlider) {
  const station = getForecastStation();
  const crop = WHEAT_TYPES[state.wheatType];
  if (!station || !crop) {
    elements.outlookHeading.textContent = "7-day outlook";
    elements.selectedDateLabel.textContent = "";
    elements.rangeStart.textContent = "Now";
    elements.rangeEnd.textContent = "End of forecast";
    elements.recommendationText.textContent = "Select a primary location and wheat type in the Map section to view the 7-day prediction.";
    elements.weeklyStats.innerHTML = "";
    if (updateForecastSlider) {
      elements.dateSlider.value = "0";
    }
    return;
  }

  const week = station.series.slice(state.selectedIndex, state.selectedIndex + 7);
  const stats = summarizeWeek(week);

  if (updateForecastSlider) {
    elements.dateSlider.value = String(state.selectedIndex);
  }

  elements.outlookHeading.textContent = `${station.stationName} • ${crop.label}`;
  elements.selectedDateLabel.textContent = `${formatLongDate(week[0].date)} to ${formatLongDate(week[week.length - 1].date)}`;
  elements.rangeStart.textContent = "Now";
  elements.rangeEnd.textContent = "End of forecast";
  elements.recommendationText.textContent = buildRecommendationText(station, crop.label, stats);

  elements.weeklyStats.innerHTML = `
    ${renderStatTile(FORECAST_ICONS.temperature, "Temperature", `${stats.avgMinTemp.toFixed(1)}°C to ${stats.avgMaxTemp.toFixed(1)}°C`)}
    ${renderStatTile(FORECAST_ICONS.rainfall, "Rainfall", `${stats.avgRainfall.toFixed(2)} mm/day`)}
    ${renderStatTile(FORECAST_ICONS.windSpeed, "Wind", `${stats.avgWindSpeed.toFixed(1)} km/h`)}
  `;
}

function buildRecommendationText(station, cropLabel, stats) {
  const favorable = stats.avgMaxTemp <= 25 && stats.avgWindSpeed <= 18 && stats.avgRainfall >= 1.2;
  const cautious = stats.avgMaxTemp > 29 || stats.avgWindSpeed > 22 || stats.avgRainfall < 0.5;

  if (favorable) {
    return `It is advised to plant ${cropLabel} in ${station.stationName} over this 7-day window. The outlook is favorable for planting conditions.`;
  }

  if (cautious) {
    return `It is not advised to plant ${cropLabel} in ${station.stationName} over this 7-day window. The outlook is too risky for confident planting conditions.`;
  }

  return `Planting ${cropLabel} in ${station.stationName} should be approached with caution over this 7-day window. The outlook is mixed, so conditions should be reviewed closely before deciding.`;
}

function renderMap() {
  const primary = getForecastStation();
  const secondaryStations = getSecondaryStations();
  const colorLookup = buildStationColorLookup(primary, secondaryStations);

  elements.mapDescription.textContent = `This map shows all weather stations and highlights the primary location in green, secondary location 1 in blue, and secondary location 2 in red when selected.`;

  elements.stationMap.innerHTML = `
    <svg viewBox="${mapData.viewBox.join(" ")}" role="img" aria-label="Australia map with weather stations">
      ${mapData.states.map((stateShape) => `
        <path d="${stateShape.path}" fill="#0c3158" opacity="0.26" stroke="none"></path>
      `).join("")}
      ${mapData.states.map((stateShape) => `
        <path d="${stateShape.path}" fill="none" stroke="#5ea8ff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" data-tooltip="${stateShape.name}"></path>
      `).join("")}
      ${stationList.map((station) => renderStationMarker(station, colorLookup)).join("")}
    </svg>
  `;

  elements.mapLegend.innerHTML = `
    ${renderLegendCard("Primary location", primary ? `${primary.stationName}, ${primary.state}` : "Select location", HISTORY_COLORS.primary)}
    ${secondaryStations[0] ? renderLegendCard("Secondary location 1", `${secondaryStations[0].stationName}, ${secondaryStations[0].state}`, HISTORY_COLORS.secondaryOne) : ""}
    ${secondaryStations[1] ? renderLegendCard("Secondary location 2", `${secondaryStations[1].stationName}, ${secondaryStations[1].state}`, HISTORY_COLORS.secondaryTwo) : ""}
  `;

  attachTooltipListeners(elements.stationMap);
}

function renderStationMarker(station, colorLookup) {
  const point = STATION_COORDS[String(station.stationNumber)];
  if (!point) {
    return "";
  }

  const marker = colorLookup.get(String(station.stationNumber));
  if (!marker) {
    return `
      <circle cx="${point.x}" cy="${point.y}" r="5" fill="#9bb8d8" stroke="#0b2038" stroke-width="2"
        data-tooltip="${station.stationName}, ${station.state} • Station ${station.stationNumber}"></circle>
    `;
  }

  if (marker.type === "primary") {
    return `
      <circle cx="${point.x}" cy="${point.y}" r="12" fill="none" stroke="${marker.color}" stroke-width="3"></circle>
      <circle cx="${point.x}" cy="${point.y}" r="8" fill="none" stroke="${marker.color}" stroke-width="3"></circle>
      <circle cx="${point.x}" cy="${point.y}" r="5" fill="${marker.color}" stroke="#06203b" stroke-width="2"
        data-tooltip="${station.stationName}, ${station.state} • Station ${station.stationNumber}"></circle>
    `;
  }

  return `
    <circle cx="${point.x}" cy="${point.y}" r="7" fill="${marker.color}" stroke="#06203b" stroke-width="2"
      data-tooltip="${station.stationName}, ${station.state} • Station ${station.stationNumber}"></circle>
  `;
}

function buildStationColorLookup(primary, secondaryStations) {
  const lookup = new Map();
  if (primary) {
    lookup.set(String(primary.stationNumber), { color: HISTORY_COLORS.primary, type: "primary" });
  }
  if (secondaryStations[0]) {
    lookup.set(String(secondaryStations[0].stationNumber), { color: HISTORY_COLORS.secondaryOne, type: "secondary" });
  }
  if (secondaryStations[1]) {
    lookup.set(String(secondaryStations[1].stationNumber), { color: HISTORY_COLORS.secondaryTwo, type: "secondary" });
  }
  return lookup;
}

function renderLegendCard(label, text, color) {
  return `
    <article class="summary-card">
      <div class="legend-chip"><span style="background:${color}"></span>${label}</div>
      <div class="summary-name">${text}</div>
    </article>
  `;
}

function renderHistoricalComparison() {
  const metric = HISTORICAL_METRICS[state.historyMetric];
  const description = buildHistoryDescription(metric.label);
  const periods = getFilteredPeriods();
  const primaryStation = getForecastStation();
  if (!primaryStation) {
    elements.temperatureModeGroup.style.display = state.historyMetric === "temperature" ? "grid" : "none";
    elements.historyDescription.textContent = description;
    elements.historyChart.innerHTML = `<div class="empty-chart">Select a primary location in the Map section to view historical comparisons.</div>`;
    return;
  }
  const secondaryStations = getSecondaryStations();
  const groups = [primaryStation, ...secondaryStations].map((station, index) => {
    const role = index === 0 ? "primary" : index === 1 ? "secondaryOne" : "secondaryTwo";
    return buildHistoryGroup(station, periods, role, state.historyMetric);
  });

  elements.temperatureModeGroup.style.display = state.historyMetric === "temperature" ? "grid" : "none";
  elements.historyDescription.textContent = description;

  renderHistoricalChart(groups, periods, metric);
}

function buildHistoryDescription(metricLabel) {
  if (state.historyMetric === "temperature") {
    return "This graph displays the selected monthly temperature values over the chosen period for the primary location and up to two secondary locations so they can be compared.";
  }
  if (state.historyMetric === "rainfall") {
    return "This graph displays the monthly rainfall over the selected period for the primary location and up to two secondary locations so they can be compared.";
  }
  return "This graph displays the monthly wind speed over the selected period for the primary location and up to two secondary locations so they can be compared.";
}

function renderHistoricalChart(groups, periods, metric) {
  const width = 860;
  const height = 360;
  const padding = 46;
  const lineSets = buildLineSets(groups, metric);
  const allValues = lineSets.flatMap((line) => line.points.map((point) => point.value));

  if (!allValues.length || !periods.length) {
    elements.historyChart.innerHTML = `<div class="empty-chart">No historical data is available for the selected metric, date range, and locations.</div>`;
    return;
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(max - min, 1);
  const ticks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    return {
      y: padding + ratio * (height - padding * 2),
      value: max - ratio * span
    };
  });

  const chartLines = lineSets.map((line) => {
    const coords = line.points.map((point) => {
      const x = padding + (periods.indexOf(point.period) / Math.max(periods.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
      return { ...point, x, y };
    });

    return {
      ...line,
      coords
    };
  });

  elements.historyChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical comparison graph">
      ${ticks.map((tick) => `
        <line x1="${padding}" x2="${width - padding}" y1="${tick.y}" y2="${tick.y}" stroke="rgba(255,255,255,0.14)" stroke-dasharray="4 6"></line>
        <text x="${padding - 10}" y="${tick.y + 4}" fill="rgba(224,238,255,0.72)" font-size="12" text-anchor="end">${tick.value.toFixed(1)}</text>
      `).join("")}
      ${chartLines.map((line) => `
        <polyline fill="none" stroke="${line.color}" stroke-width="${line.style === "solid" ? 4 : 3}" stroke-dasharray="${line.style === "dashed" ? "8 7" : ""}" stroke-linecap="round" stroke-linejoin="round" points="${line.coords.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>
        ${line.coords.map((point) => `
          <circle cx="${point.x}" cy="${point.y}" r="7" fill="transparent" data-tooltip="${line.name} • ${formatPeriodLabel(point.period)} • ${metric.formatter(point.value)}"></circle>
          <circle cx="${point.x}" cy="${point.y}" r="${line.style === "solid" ? 4 : 3}" fill="${line.color}"></circle>
        `).join("")}
      `).join("")}
      ${periods.map((period, index) => {
        const x = padding + (index / Math.max(periods.length - 1, 1)) * (width - padding * 2);
        return `<text x="${x}" y="${height - 8}" fill="rgba(224,238,255,0.72)" font-size="12" text-anchor="middle">${formatPeriodLabel(period, true)}</text>`;
      }).join("")}
    </svg>
    <div class="chart-legend">
      ${chartLines.map((line) => `
        <span><i class="${line.style === "dashed" ? "legend-dashed" : ""}" style="${line.style === "dashed" ? `border-color:${line.color}` : `background:${line.color}` }"></i>${line.name}</span>
      `).join("")}
    </div>
  `;

  attachTooltipListeners(elements.historyChart);
}

function buildLineSets(groups, metric) {
  if (metric.mode === "single") {
    return groups
      .map((group) => ({
        name: group.station.stationName,
        color: group.color,
        style: "solid",
        points: group.points
      }))
      .filter((line) => line.points.length);
  }

  if (state.temperatureMode === "min") {
    return groups
      .map((group) => ({
        name: `${group.station.stationName} min`,
        color: group.color,
        style: "dashed",
        points: group.minPoints
      }))
      .filter((line) => line.points.length);
  }

  if (state.temperatureMode === "max") {
    return groups
      .map((group) => ({
        name: `${group.station.stationName} max`,
        color: group.color,
        style: "solid",
        points: group.maxPoints
      }))
      .filter((line) => line.points.length);
  }

  return groups.flatMap((group) => {
    const lines = [];
    if (group.maxPoints.length) {
      lines.push({ name: `${group.station.stationName} max`, color: group.color, style: "solid", points: group.maxPoints });
    }
    if (group.minPoints.length) {
      lines.push({ name: `${group.station.stationName} min`, color: group.color, style: "dashed", points: group.minPoints });
    }
    return lines;
  });
}

function buildHistoryGroup(station, periods, role, metricKey) {
  const color = HISTORY_COLORS[role];
  const history = historicalData.stations[String(station.stationNumber)];
  if (metricKey === "temperature") {
    return {
      station,
      color,
      maxPoints: filterPointsByPeriods(history.maxTemp, periods),
      minPoints: filterPointsByPeriods(history.minTemp, periods)
    };
  }

  return {
    station,
    color,
    points: filterPointsByPeriods(history[metricKey], periods)
  };
}

function filterPointsByPeriods(points, periods) {
  const allowed = new Set(periods);
  return points.filter((point) => allowed.has(point.period));
}

function renderStatTile(icon, label, value) {
  return `
    <article class="stat-tile">
      <div class="stat-icon">${icon}</div>
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function summarizeWeek(week) {
  return {
    avgMaxTemp: average(week.map((entry) => entry.maxTemp)),
    avgMinTemp: average(week.map((entry) => entry.minTemp)),
    avgRainfall: average(week.map((entry) => entry.rainfall)),
    avgWindSpeed: average(week.map((entry) => entry.windSpeed))
  };
}

function getMetricPeriods(metricKey) {
  return GLOBAL_HISTORY_PERIODS;
}

function getFilteredPeriods() {
  const periods = getMetricPeriods(state.historyMetric);
  const startIndex = periodIndex(state.historyStart, periods);
  const endIndex = periodIndex(state.historyEnd, periods);
  return periods.slice(startIndex, endIndex + 1);
}

function periodIndex(period, periods = getMetricPeriods(state.historyMetric)) {
  return Math.max(0, periods.indexOf(period));
}

function getForecastStation() {
  return state.forecastLocation ? forecastData.stations[state.forecastLocation] : null;
}

function getSecondaryStations() {
  return state.compareStations
    .filter(Boolean)
    .filter((stationId) => stationId !== state.forecastLocation)
    .map((stationId) => forecastData.stations[stationId])
    .filter(Boolean);
}

function buildMonthlyPeriods(startPeriod, endPeriod) {
  const periods = [];
  let [year, month] = startPeriod.split("-").map(Number);
  const [endYear, endMonth] = endPeriod.split("-").map(Number);

  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return periods;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatLongDate(dateString) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(dateString));
}

function formatPeriodLabel(period, short = false) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    month: short ? "short" : "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function attachTooltipListeners(container) {
  const tooltipTargets = container.querySelectorAll("[data-tooltip]");
  tooltipTargets.forEach((target) => {
    target.addEventListener("mouseenter", showTooltip);
    target.addEventListener("mousemove", moveTooltip);
    target.addEventListener("mouseleave", hideTooltip);
  });
}

function showTooltip(event) {
  const text = event.currentTarget.getAttribute("data-tooltip");
  elements.hoverTooltip.textContent = text;
  elements.hoverTooltip.classList.add("visible");
  moveTooltip(event);
}

function moveTooltip(event) {
  elements.hoverTooltip.style.left = `${event.pageX + 14}px`;
  elements.hoverTooltip.style.top = `${event.pageY + 14}px`;
}

function hideTooltip() {
  elements.hoverTooltip.classList.remove("visible");
}
