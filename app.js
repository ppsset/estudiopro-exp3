const MODULES = [
  {
    id: "conduit",
    title: "Conduit & Wireway Sizing",
    description: "Conduit/wireway fill sizing with conductor OD library support.",
    icon: "🧰",
  },
  {
    id: "vdrop",
    title: "Voltage Drop Calculation",
    description: "AC drop with resistive or impedance method.",
    icon: "📉",
  },
  {
    id: "shortcircuit",
    title: "Short Circuit Calculation",
    description: "Transformer-based fault current estimate with cable impedance.",
    icon: "⚠️",
  },
  {
    id: "pfc",
    title: "Power Factor Correction",
    description: "Capacitor bank sizing and payback estimate.",
    icon: "🧮",
  },
  {
    id: "powerquality",
    title: "Power Quality Improvement",
    description: "Rules-based diagnostics and recommendations.",
    icon: "🎛️",
  },
  {
    id: "pv",
    title: "PV System Design",
    description: "PV sizing and 25-year cashflow overview.",
    icon: "☀️",
  },
];

const DEFAULT_LIBRARY = {
  conductors: {
    cu: { resistivity: 0.01724, tempCoeff: 0.00393 },
    al: { resistivity: 0.02826, tempCoeff: 0.00403 },
  },
  reactance: {
    "25": { r: 0.78, x: 0.08 },
    "50": { r: 0.39, x: 0.075 },
    "70": { r: 0.27, x: 0.07 },
    "95": { r: 0.2, x: 0.065 },
    "120": { r: 0.16, x: 0.062 },
    "150": { r: 0.13, x: 0.06 },
  },
  cableOd: {
    "25": 12,
    "50": 18,
    "70": 22,
    "95": 26,
    "120": 30,
    "150": 34,
  },
  fillLimits: {
    conduitPercent: 40,
    wirewayPercent: 20,
    conduitSizes: {
      pvc: [20, 25, 32, 40, 50, 63, 75, 90, 110],
      emt: [16, 21, 27, 35, 41, 53, 63, 78, 91],
      rmc: [21, 27, 35, 41, 53, 63, 78, 91, 103],
      hdpe: [32, 40, 50, 63, 75, 90, 110, 125],
    },
    wirewaySizes: [
      { w: 100, h: 50 },
      { w: 150, h: 100 },
      { w: 200, h: 100 },
      { w: 300, h: 150 },
      { w: 400, h: 200 },
    ],
  },
};

const DEFAULT_SETTINGS = {
  frequency: "50",
  voltageSystems: "400/230V, 415/240V, 480/277V",
  material: "cu",
  temperature: 75,
  currency: "USD",
  format: "en-US",
};

const STORAGE_KEY = "eeToolboxData";

const state = {
  library: structuredClone(DEFAULT_LIBRARY),
  settings: structuredClone(DEFAULT_SETTINGS),
  scenarios: {
    conduit: [],
    vdrop: [],
    shortcircuit: [],
    pfc: [],
    powerquality: [],
    pv: [],
  },
  recent: [],
  favorites: [],
};

const numberFormat = () => new Intl.NumberFormat(state.settings.format, { maximumFractionDigits: 3 });

const format = (value, unit = "") => `${numberFormat().format(value)}${unit ? ` ${unit}` : ""}`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const loadState = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    Object.assign(state, parsed);
  }
};

const renderModuleCards = () => {
  const container = document.getElementById("moduleCards");
  const template = document.getElementById("module-card-template");
  container.innerHTML = "";
  MODULES.forEach((module) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".module-icon").textContent = module.icon;
    node.querySelector("h3").textContent = module.title;
    node.querySelector("p").textContent = module.description;
    node.querySelector("button").addEventListener("click", () => showSection(`module-${module.id}`));
    container.appendChild(node);
  });
};

const showSection = (id) => {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === id);
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.section === id);
  });
};

const toggleSidebar = () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
};

const getFormData = (moduleId) => {
  const form = document.querySelector(`[data-form="${moduleId}"]`);
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (data[key]) {
      if (!Array.isArray(data[key])) {
        data[key] = [data[key]];
      }
      data[key].push(value);
    } else {
      data[key] = value;
    }
  });
  form.querySelectorAll("input[type='checkbox'][name='symptoms']").forEach((checkbox) => {
    if (!data.symptoms) data.symptoms = [];
    if (checkbox.checked) data.symptoms.push(checkbox.value);
  });
  return data;
};

const validatePositive = (value, label) => {
  const number = Number(value);
  if (Number.isNaN(number) || number <= 0) {
    return `${label} must be greater than 0.`;
  }
  return null;
};

const createResultBlock = (title, value, detail = "") => `
  <div class="highlight">
    <strong>${title}</strong>
    <div>${value}</div>
    ${detail ? `<small>${detail}</small>` : ""}
  </div>
`;

const updateNotes = (moduleId, notes) => {
  const container = document.querySelector(`[data-notes="${moduleId}"]`);
  container.innerHTML = notes.map((note) => `<p>${note}</p>`).join("");
};

const updateResults = (moduleId, html) => {
  const container = document.querySelector(`[data-results="${moduleId}"]`);
  container.innerHTML = html;
};

const pushRecent = (moduleId, summary) => {
  state.recent.unshift({ moduleId, summary, time: new Date().toISOString() });
  state.recent = state.recent.slice(0, 6);
};

const renderDashboardLists = () => {
  const recentList = document.getElementById("recentList");
  const favoritesList = document.getElementById("favoritesList");
  recentList.innerHTML = state.recent.length
    ? state.recent.map((item) => `<li>${item.summary}</li>`).join("")
    : "<li>No calculations yet.</li>";
  favoritesList.innerHTML = state.favorites.length
    ? state.favorites.map((item) => `<li>${item.summary}</li>`).join("")
    : "<li>No favorites yet.</li>";
};

const conductorResistance = (material, area, temperature) => {
  const ref = state.library.conductors[material];
  const r20 = ref.resistivity / area;
  const rT = r20 * (1 + ref.tempCoeff * (temperature - 20));
  return rT; // ohm/m
};

const findConduitSize = (type, requiredArea) => {
  const sizes = state.library.fillLimits.conduitSizes[type] || [];
  const match = sizes.find((diameter) => Math.PI * (diameter / 2) ** 2 >= requiredArea);
  return match || sizes[sizes.length - 1] || null;
};

const findWirewaySize = (requiredArea) => {
  const sizes = state.library.fillLimits.wirewaySizes;
  const match = sizes.find((size) => size.w * size.h >= requiredArea);
  return match || sizes[sizes.length - 1];
};

const calculateConduit = (data) => {
  const errors = [];
  [
    [data.conductorSize, "Conductor size"],
    [data.cableOd, "Cable OD"],
    [data.conduitId, "Conduit internal diameter"],
  ].forEach(([value, label]) => {
    const err = validatePositive(value, label);
    if (err) errors.push(err);
  });

  if (errors.length) {
    return { errors };
  }

  const counts = [
    Number(data.phaseCount || 0),
    Number(data.neutralCount || 0),
    Number(data.groundCount || 0),
    Number(data.spareCount || 0),
  ];
  const totalConductors = counts.reduce((a, b) => a + b, 0);
  const cableOd = Number(data.cableOd || 0);
  const cableArea = Math.PI * (cableOd / 2) ** 2;
  const totalArea = cableArea * totalConductors;
  const fillLimit = Number(data.fillLimit || state.library.fillLimits.conduitPercent) / 100;
  const wirewayFill = Number(data.wirewayFill || state.library.fillLimits.wirewayPercent) / 100;
  const requiredConduitArea = totalArea / fillLimit;
  const requiredWirewayArea = totalArea / wirewayFill;
  const conduitId = Number(data.conduitId);
  const availableConduitArea = Math.PI * (conduitId / 2) ** 2;
  const fillPercent = (totalArea / availableConduitArea) * 100;
  const recommendedConduit = findConduitSize(data.conduitType, requiredConduitArea);
  const wirewayArea = Number(data.wirewayW) * Number(data.wirewayH);
  const wirewayFillPercent = (totalArea / wirewayArea) * 100;
  const recommendedWireway = findWirewaySize(requiredWirewayArea);

  const summaryTable = `
    <table>
      <tr><th>Conductor type</th><th>Count</th><th>Assumed OD (mm)</th></tr>
      <tr><td>Phase</td><td>${data.phaseCount}</td><td>${cableOd}</td></tr>
      <tr><td>Neutral</td><td>${data.neutralCount}</td><td>${cableOd}</td></tr>
      <tr><td>Ground</td><td>${data.groundCount}</td><td>${cableOd}</td></tr>
      <tr><td>Spares</td><td>${data.spareCount}</td><td>${cableOd}</td></tr>
    </table>
  `;

  const steps = [
    `Total conductors = ${totalConductors} conductors`,
    `Cable area = π × (OD/2)^2 = ${format(cableArea, "mm²")}`,
    `Total conductor area = ${format(totalArea, "mm²")}`,
    `Required conduit area = Total area / fill limit = ${format(requiredConduitArea, "mm²")}`,
    `Required wireway area = Total area / wireway fill = ${format(requiredWirewayArea, "mm²")}`,
  ];

  const warnings = [];
  if (fillPercent > Number(data.fillLimit)) {
    warnings.push("Conduit fill exceeds selected limit.");
  }
  if (wirewayFillPercent > Number(data.wirewayFill)) {
    warnings.push("Wireway fill exceeds selected limit.");
  }

  return {
    results: {
      requiredConduitArea,
      requiredWirewayArea,
      fillPercent,
      wirewayFillPercent,
      recommendedConduit,
      recommendedWireway,
      summaryTable,
      steps,
      warnings,
    },
  };
};

const calculateVdrop = (data) => {
  const errors = [];
  [
    [data.voltage, "Voltage"],
    [data.length, "Length"],
    [data.conductorSize, "Conductor size"],
  ].forEach(([value, label]) => {
    const err = validatePositive(value, label);
    if (err) errors.push(err);
  });
  if (errors.length) return { errors };

  const voltage = Number(data.voltage);
  let current = Number(data.current);
  const powerKw = Number(data.powerKw);
  const length = Number(data.length);
  const conductorSize = Number(data.conductorSize);
  const temperature = Number(data.temperature);
  const parallel = Math.max(1, Number(data.parallels));
  const pf = Number(data.pf);
  const phi = Math.acos(clamp(pf, 0.1, 1));
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const method = data.method;
  const lengthFactor = data.system === "3ph" ? Math.sqrt(3) : 2;
  const lengthMultiplier = data.lengthType === "loop" ? 0.5 : 1;
  if ((!current || Number.isNaN(current)) && powerKw > 0) {
    const kva = powerKw / pf;
    current = data.system === "3ph"
      ? (kva * 1000) / (Math.sqrt(3) * voltage)
      : (kva * 1000) / voltage;
  }
  const currentError = validatePositive(current, "Load current");
  if (currentError) return { errors: [currentError] };
  const rPerM = conductorResistance(data.material, conductorSize, temperature);
  const rTotal = (rPerM * length * lengthMultiplier) / parallel;
  const xPerKm = Number(data.reactance);
  const xTotal = (xPerKm / 1000) * length * lengthMultiplier / parallel;
  const drop =
    lengthFactor *
    current *
    (rTotal * cosPhi + (method === "rx" ? xTotal * sinPhi : 0));
  const dropPercent = (drop / voltage) * 100;
  const receiving = voltage - drop;
  const pass = dropPercent <= Number(data.limit);
  const steps = [
    `R (Ω) = ρ/area × length = ${format(rTotal, "Ω")}`,
    `X (Ω) = ${format(xTotal, "Ω")}`,
    `ΔV = ${lengthFactor.toFixed(2)} × I × (R·cosφ + X·sinφ)`,
    `ΔV = ${format(drop, "V")}`,
  ];

  return {
    results: {
      drop,
      dropPercent,
      receiving,
      pass,
      steps,
    },
  };
};

const calculateShortCircuit = (data) => {
  const errors = [];
  [
    [data.kva, "Transformer kVA"],
    [data.secondaryV, "Secondary voltage"],
    [data.percentZ, "%Z"],
  ].forEach(([value, label]) => {
    const err = validatePositive(value, label);
    if (err) errors.push(err);
  });
  if (errors.length) return { errors };

  const kva = Number(data.kva);
  const secondaryV = Number(data.secondaryV);
  const percentZ = Number(data.percentZ);
  const zBase = (secondaryV ** 2) / (kva * 1000);
  const zSource = (percentZ / 100) * zBase;
  const isym = secondaryV / zSource;

  let zCable = 0;
  let totalZ = zSource;
  if (data.faultLocation === "feeder") {
    const length = Number(data.feederLength);
    const sizeKey = String(Math.round(Number(data.conductorSize)));
    const lib = state.library.reactance[sizeKey] || { r: 0.3, x: 0.08 };
    const r = (lib.r / 1000) * length;
    const x = (lib.x / 1000) * length;
    zCable = Math.sqrt(r ** 2 + x ** 2) / Math.max(1, Number(data.parallels));
    totalZ = zSource + zCable;
  }

  const faultCurrent = secondaryV / totalZ;
  const xr = Number(data.xr) || null;
  const peak = xr ? faultCurrent * (1 + 0.2 * xr) : null;
  const steps = [
    `Zbase = V² / S = ${format(zBase, "Ω")}`,
    `Zsource = %Z × Zbase = ${format(zSource, "Ω")}`,
    `Zcable = ${format(zCable, "Ω")}`,
    `Ztotal = ${format(totalZ, "Ω")}`,
  ];

  return {
    results: {
      faultCurrent,
      peak,
      zSource,
      zCable,
      totalZ,
      steps,
    },
  };
};

const calculatePfc = (data) => {
  const errors = [];
  [
    [data.kw, "Real power"],
    [data.pfExisting, "Existing PF"],
    [data.pfTarget, "Target PF"],
    [data.voltage, "Voltage"],
  ].forEach(([value, label]) => {
    const err = validatePositive(value, label);
    if (err) errors.push(err);
  });
  if (errors.length) return { errors };

  const kw = Number(data.kw);
  const pfExisting = clamp(Number(data.pfExisting), 0.1, 1);
  const pfTarget = clamp(Number(data.pfTarget), pfExisting, 1);
  const phi1 = Math.acos(pfExisting);
  const phi2 = Math.acos(pfTarget);
  const kvar = kw * (Math.tan(phi1) - Math.tan(phi2));
  const standardBanks = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500];
  const recommended = standardBanks.find((size) => size >= kvar) || kvar;
  const voltage = Number(data.voltage);
  const currentBefore = data.system === "3ph"
    ? (kw * 1000) / (Math.sqrt(3) * voltage * pfExisting)
    : (kw * 1000) / (voltage * pfExisting);
  const currentAfter = data.system === "3ph"
    ? (kw * 1000) / (Math.sqrt(3) * voltage * pfTarget)
    : (kw * 1000) / (voltage * pfTarget);
  const penalty = Number(data.penalty || 0);
  const annualSavings = penalty > 0 ? kvar * penalty : 0;
  const steps = [
    `φ1 = arccos(PF₁) = ${format(phi1, "rad")}`,
    `φ2 = arccos(PF₂) = ${format(phi2, "rad")}`,
    `kvar = kW × (tanφ1 - tanφ2) = ${format(kvar, "kvar")}`,
  ];

  return {
    results: {
      kvar,
      recommended,
      currentBefore,
      currentAfter,
      annualSavings,
      steps,
    },
  };
};

const calculatePowerQuality = (data) => {
  const thdv = Number(data.thdv);
  const thdi = Number(data.thdi);
  const unbalance = Number(data.unbalance);
  const pf = Number(data.pf);
  const sags = Number(data.sags);
  const vfd = Number(data.vfd);
  const ups = Number(data.ups);
  const symptoms = data.symptoms || [];

  const recs = [];
  if (thdi > 15 || vfd > 30 || ups > 10) {
    recs.push("Install passive or active harmonic filters to reduce current distortion.");
  }
  if (thdv > 5) {
    recs.push("Consider line reactors or isolation transformers to mitigate voltage THD.");
  }
  if (symptoms.includes("neutral") || thdi > 20) {
    recs.push("Specify K-rated transformer or oversized neutral conductors.");
  }
  if (symptoms.includes("capacitor") || pf < 0.9) {
    recs.push("Use capacitor bank detuning reactors to avoid resonance.");
  }
  if (unbalance > 2) {
    recs.push("Perform phase balancing and check single-phase load distribution.");
  }
  if (sags > 2 || symptoms.includes("flicker")) {
    recs.push("Evaluate UPS ride-through or dynamic voltage restorer (DVR) options.");
  }
  if (symptoms.includes("trips")) {
    recs.push("Review protective device settings and nuisance trip coordination.");
  }
  if (symptoms.includes("vfdnoise")) {
    recs.push("Add line reactors and proper grounding for VFD installations.");
  }

  const nextMeasures = [
    "Capture 7-day PQ analyzer trend with THD, sags, swells.",
    "Measure neutral current and harmonic spectrum.",
    "Verify transformer loading and temperature rise.",
  ];

  const expectationTable = `
    <table>
      <tr><th>Metric</th><th>Before</th><th>After (expected)</th></tr>
      <tr><td>THD-I</td><td>${thdi}%</td><td>${Math.max(5, thdi - 8)}%</td></tr>
      <tr><td>THD-V</td><td>${thdv}%</td><td>${Math.max(3, thdv - 2)}%</td></tr>
      <tr><td>Unbalance</td><td>${unbalance}%</td><td>${Math.max(1, unbalance - 0.5)}%</td></tr>
    </table>
  `;

  const steps = [
    "Assess symptoms, THD, unbalance, and load mix.",
    "Match symptoms to mitigation options based on best practice guidance.",
    "Rank recommendations by urgency and impact.",
  ];

  return {
    results: {
      recs,
      nextMeasures,
      expectationTable,
      steps,
    },
  };
};

const calculatePv = (data) => {
  const errors = [];
  [
    [data.area, "Available area"],
    [data.panelPower, "Panel power"],
    [data.panelArea, "Panel area"],
    [data.pr, "Performance ratio"],
    [data.dcac, "DC/AC ratio"],
  ].forEach(([value, label]) => {
    const err = validatePositive(value, label);
    if (err) errors.push(err);
  });
  if (errors.length) return { errors };

  const area = Number(data.area);
  const panelPower = Number(data.panelPower);
  const panelArea = Number(data.panelArea);
  const pr = Number(data.pr);
  const irradiation = Number(data.irradiation);
  const annualYield = Number(data.annualYield);
  const dcac = Number(data.dcac);
  const price = Number(data.price);
  const escalation = Number(data.escalation) / 100;
  const costPerKw = Number(data.costPerKw);
  const om = Number(data.om) / 100;
  const incentives = Number(data.incentives);

  const panelCount = Math.floor(area / panelArea);
  const systemSize = (panelCount * panelPower) / 1000;
  const inverterSize = systemSize / dcac;
  const energy = annualYield > 0 ? systemSize * annualYield * pr : systemSize * irradiation * 365 * pr;
  const capex = systemSize * costPerKw - incentives;

  let cumulative = -capex;
  let payback = null;
  const cashflowRows = [];
  for (let year = 1; year <= 25; year += 1) {
    const revenue = energy * price * (1 + escalation) ** (year - 1);
    const omCost = capex * om;
    const net = revenue - omCost;
    cumulative += net;
    if (cumulative >= 0 && payback === null) {
      payback = year;
    }
    cashflowRows.push(`<tr><td>${year}</td><td>${format(revenue)}</td><td>${format(net)}</td><td>${format(cumulative)}</td></tr>`);
  }

  const cashflowTable = `
    <table>
      <tr><th>Year</th><th>Revenue</th><th>Net</th><th>Cumulative</th></tr>
      ${cashflowRows.join("")}
    </table>
  `;

  const steps = [
    `Panel count = floor(area / panelArea) = ${panelCount}`,
    `System size = panels × W / 1000 = ${format(systemSize, "kWp")}`,
    `Annual energy = size × yield × PR = ${format(energy, "kWh/yr")}`,
  ];

  return {
    results: {
      panelCount,
      systemSize,
      inverterSize,
      energy,
      payback,
      cashflowTable,
      capex,
      steps,
    },
  };
};

const calculations = {
  conduit: calculateConduit,
  vdrop: calculateVdrop,
  shortcircuit: calculateShortCircuit,
  pfc: calculatePfc,
  powerquality: calculatePowerQuality,
  pv: calculatePv,
};

const renderScenarioPanel = (moduleId) => {
  const panel = document.querySelector(`[data-scenarios="${moduleId}"]`);
  const scenarios = state.scenarios[moduleId];
  if (!scenarios || scenarios.length === 0) {
    panel.classList.remove("active");
    return;
  }
  panel.classList.add("active");
  panel.innerHTML = `
    <h3>Saved Scenarios</h3>
    <div class="scenario-list">
      ${scenarios
        .map(
          (scenario, index) => `
        <div class="scenario-card">
          <h4>${scenario.name}</h4>
          <p>${scenario.summary}</p>
          <div class="scenario-actions">
            <button class="secondary" data-load="${moduleId}" data-index="${index}">Load</button>
            <button class="secondary" data-favorite="${moduleId}" data-index="${index}">Favorite</button>
            <button class="secondary" data-delete="${moduleId}" data-index="${index}">Delete</button>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
};

const renderComparePanel = (moduleId) => {
  const panel = document.querySelector(`[data-compare-panel="${moduleId}"]`);
  const scenarios = state.scenarios[moduleId];
  if (!scenarios || scenarios.length < 2) {
    panel.classList.remove("active");
    panel.innerHTML = "";
    return;
  }
  panel.classList.add("active");
  const options = scenarios.map((scenario, index) => `<option value="${index}">${scenario.name}</option>`).join("");
  panel.innerHTML = `
    <h3>Compare Scenarios</h3>
    <div class="form-grid">
      <label>Scenario A
        <select data-compare-select="a">${options}</select>
      </label>
      <label>Scenario B
        <select data-compare-select="b">${options}</select>
      </label>
      <button class="secondary" data-run-compare="${moduleId}">Run Compare</button>
    </div>
    <div class="compare-grid" data-compare-results="${moduleId}"></div>
  `;
};

const runCompare = (moduleId) => {
  const panel = document.querySelector(`[data-compare-panel="${moduleId}"]`);
  const selectA = panel.querySelector("[data-compare-select='a']");
  const selectB = panel.querySelector("[data-compare-select='b']");
  const resultsContainer = panel.querySelector(`[data-compare-results="${moduleId}"]`);
  const scenarioA = state.scenarios[moduleId][Number(selectA.value)];
  const scenarioB = state.scenarios[moduleId][Number(selectB.value)];

  resultsContainer.innerHTML = `
    <table>
      <tr><th>Metric</th><th>${scenarioA.name}</th><th>${scenarioB.name}</th></tr>
      <tr><td>Summary</td><td>${scenarioA.summary}</td><td>${scenarioB.summary}</td></tr>
      <tr><td>Result Snapshot</td><td>${scenarioA.snapshot}</td><td>${scenarioB.snapshot}</td></tr>
    </table>
  `;
};

const setFormValues = (moduleId, values) => {
  const form = document.querySelector(`[data-form="${moduleId}"]`);
  Object.entries(values).forEach(([key, value]) => {
    const field = form.querySelector(`[name="${key}"]`);
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = value;
    } else {
      field.value = value;
    }
  });
};

const exampleInputs = {
  conduit: {
    system: "3ph",
    voltageLabel: "400 V",
    material: "cu",
    conductorSize: 70,
    insulation: "xlpe",
    phaseCount: 3,
    neutralCount: 1,
    groundCount: 1,
    spareCount: 1,
    cableOd: 22,
    conduitType: "emt",
    conduitId: 63,
    fillLimit: 40,
    wirewayFill: 20,
    wirewayW: 200,
    wirewayH: 100,
  },
  vdrop: {
    system: "3ph",
    voltage: 400,
    current: 150,
    powerKw: 80,
    pf: 0.9,
    length: 120,
    lengthType: "oneway",
    conductorSize: 70,
    material: "cu",
    temperature: 75,
    parallels: 1,
    method: "rx",
    reactance: 0.08,
    limit: 3,
  },
  shortcircuit: {
    system: "3ph",
    kva: 2000,
    primaryKv: 22,
    secondaryV: 400,
    percentZ: 6,
    xr: 8,
    faultLocation: "feeder",
    feederLength: 80,
    conductorSize: 95,
    material: "cu",
    parallels: 2,
  },
  pfc: {
    kw: 500,
    pfExisting: 0.75,
    pfTarget: 0.95,
    voltage: 400,
    system: "3ph",
    frequency: 50,
    avgKw: 350,
    peakKw: 500,
    penalty: 2,
  },
  powerquality: {
    thdv: 6,
    thdi: 22,
    unbalance: 2.5,
    sags: 3,
    pf: 0.82,
    kva: 600,
    vfd: 40,
    ups: 20,
    welding: 10,
    hvac: 30,
    lighting: "led",
  },
  pv: {
    area: 800,
    panelPower: 550,
    panelArea: 2.4,
    pr: 0.8,
    irradiation: 4.8,
    annualYield: 1500,
    dcac: 1.2,
    price: 0.12,
    escalation: 2,
    costPerKw: 900,
    om: 1.5,
    incentives: 0,
  },
};

const renderLibrary = () => {
  document.getElementById("libraryConductor").value = JSON.stringify(state.library.conductors, null, 2);
  document.getElementById("libraryReactance").value = JSON.stringify(state.library.reactance, null, 2);
  document.getElementById("libraryCable").value = JSON.stringify(state.library.cableOd, null, 2);
  document.getElementById("libraryFill").value = JSON.stringify(state.library.fillLimits, null, 2);
};

const renderSettings = () => {
  const form = document.getElementById("settingsForm");
  Object.entries(state.settings).forEach(([key, value]) => {
    const field = form.querySelector(`[name="${key}"]`);
    if (field) field.value = value;
  });
};

const saveLibrary = () => {
  try {
    state.library = {
      conductors: JSON.parse(document.getElementById("libraryConductor").value),
      reactance: JSON.parse(document.getElementById("libraryReactance").value),
      cableOd: JSON.parse(document.getElementById("libraryCable").value),
      fillLimits: JSON.parse(document.getElementById("libraryFill").value),
    };
    saveState();
    alert("Library saved.");
  } catch (error) {
    alert("Invalid JSON in library fields. Please fix and try again.");
  }
};

const saveSettings = () => {
  const form = document.getElementById("settingsForm");
  const data = Object.fromEntries(new FormData(form).entries());
  state.settings = data;
  saveState();
  alert("Settings saved.");
};

const formatSteps = (steps) => `<ol>${steps.map((step) => `<li>${step}</li>`).join("")}</ol>`;

const reportWindow = (moduleId, inputs, resultHtml) => {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
    <head>
      <title>EE Toolbox Report - ${moduleId}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { margin-bottom: 8px; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        .section { margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <h1>EE Toolbox Report</h1>
      <div class="section">
        <h2>Inputs</h2>
        <pre>${JSON.stringify(inputs, null, 2)}</pre>
      </div>
      <div class="section">
        <h2>Results</h2>
        ${resultHtml}
      </div>
      <p>For preliminary design only; verify with applicable codes/standards and manufacturer data.</p>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
};

const calculateModule = (moduleId) => {
  const data = getFormData(moduleId);
  const calculation = calculations[moduleId](data);
  if (calculation.errors) {
    updateResults(moduleId, `<div class="highlight">${calculation.errors.join("<br>")}</div>`);
    return;
  }

  let summary = "";
  let snapshot = "";

  if (moduleId === "conduit") {
    const { results } = calculation;
    summary = `Conduit fill ${format(results.fillPercent, "%")}, wireway fill ${format(results.wirewayFillPercent, "%")}`;
    snapshot = `Conduit ${results.recommendedConduit || "custom"} mm, wireway ${results.recommendedWireway.w}x${results.recommendedWireway.h} mm`;
    updateResults(
      moduleId,
      `
      ${createResultBlock(
        "Required conduit area",
        format(results.requiredConduitArea, "mm²"),
        `Recommended conduit ID: ${results.recommendedConduit || "custom"} mm`,
      )}
      ${createResultBlock(
        "Required wireway area",
        format(results.requiredWirewayArea, "mm²"),
        `Recommended wireway: ${results.recommendedWireway.w} × ${results.recommendedWireway.h} mm`,
      )}
      ${createResultBlock("Conduit fill", format(results.fillPercent, "%"))}
      ${createResultBlock("Wireway fill", format(results.wirewayFillPercent, "%"))}
      <h4>Conductor Summary</h4>
      ${results.summaryTable}
      <h4>Calculation Steps</h4>
      ${formatSteps(results.steps)}
      ${results.warnings.length ? `<div class="highlight">Warnings: ${results.warnings.join(", ")}</div>` : ""}
    `,
    );
    updateNotes(moduleId, [
      "Uses user-defined cable OD for all conductors.",
      "Conduit and wireway libraries are editable in Data Library.",
    ]);
  }

  if (moduleId === "vdrop") {
    const { results } = calculation;
    summary = `ΔV ${format(results.drop, "V")} (${format(results.dropPercent, "%")})`;
    snapshot = `Receiving voltage ${format(results.receiving, "V")}`;
    updateResults(
      moduleId,
      `
      ${createResultBlock("Voltage drop", format(results.drop, "V"), `${format(results.dropPercent, "%")} of source`)}
      ${createResultBlock("Receiving-end voltage", format(results.receiving, "V"))}
      ${createResultBlock("Pass/Fail", results.pass ? "PASS" : "FAIL", `Limit ${data.limit}%`)}
      <h4>Calculation Steps</h4>
      ${formatSteps(results.steps)}
    `,
    );
    updateNotes(moduleId, [
      "R calculated from resistivity and temperature coefficient library.",
      "Select R+X method to include reactance and power factor angle.",
    ]);
  }

  if (moduleId === "shortcircuit") {
    const { results } = calculation;
    summary = `Fault current ${format(results.faultCurrent, "A")}`;
    snapshot = `Ztotal ${format(results.totalZ, "Ω")}`;
    updateResults(
      moduleId,
      `
      ${createResultBlock("Fault current (sym RMS)", format(results.faultCurrent, "A"))}
      ${results.peak ? createResultBlock("Peak making current (estimate)", format(results.peak, "A")) : ""}
      ${createResultBlock("Zsource", format(results.zSource, "Ω"))}
      ${createResultBlock("Zcable", format(results.zCable, "Ω"))}
      ${createResultBlock("Ztotal", format(results.totalZ, "Ω"))}
      <h4>Calculation Steps</h4>
      ${formatSteps(results.steps)}
      <div class="highlight">Safety note: results are preliminary estimates. Validate with detailed short-circuit study.</div>
    `,
    );
    updateNotes(moduleId, [
      "Transformer contribution only. Upstream utility impedance not included.",
      "Cable impedance based on editable library values.",
    ]);
  }

  if (moduleId === "pfc") {
    const { results } = calculation;
    summary = `Required kvar ${format(results.kvar, "kvar")}`;
    snapshot = `Recommended bank ${format(results.recommended, "kvar")}`;
    updateResults(
      moduleId,
      `
      ${createResultBlock("Required kvar", format(results.kvar, "kvar"))}
      ${createResultBlock("Recommended bank", format(results.recommended, "kvar"))}
      ${createResultBlock("Current before", format(results.currentBefore, "A"))}
      ${createResultBlock("Current after", format(results.currentAfter, "A"))}
      ${createResultBlock("Annual savings", results.annualSavings ? format(results.annualSavings) : "N/A")}
      <h4>Calculation Steps</h4>
      ${formatSteps(results.steps)}
    `,
    );
    updateNotes(moduleId, [
      "Capacitor bank rounded to nearest standard size.",
      "Payback uses penalty rate if provided.",
    ]);
  }

  if (moduleId === "powerquality") {
    const { results } = calculation;
    summary = `Recommendations ${results.recs.length}`;
    snapshot = results.recs[0] || "No issues detected";
    updateResults(
      moduleId,
      `
      ${createResultBlock("Top recommendation", results.recs[0] || "No critical issues detected")}
      <h4>Ranked Recommendations</h4>
      <ul>${results.recs.map((rec) => `<li>${rec}</li>`).join("")}</ul>
      <h4>What to measure next</h4>
      <ul>${results.nextMeasures.map((item) => `<li>${item}</li>`).join("")}</ul>
      <h4>Before/After Expectations</h4>
      ${results.expectationTable}
      <h4>Method</h4>
      ${formatSteps(results.steps)}
    `,
    );
    updateNotes(moduleId, [
      "Recommendations are rule-based and explainable.",
      "Validate with site measurements and PQ logging.",
    ]);
  }

  if (moduleId === "pv") {
    const { results } = calculation;
    summary = `PV size ${format(results.systemSize, "kWp")}`;
    snapshot = `Payback ${results.payback ? `${results.payback} yrs` : "N/A"}`;
    updateResults(
      moduleId,
      `
      ${createResultBlock("System size", format(results.systemSize, "kWp"))}
      ${createResultBlock("Panel count", format(results.panelCount))}
      ${createResultBlock("Inverter size", format(results.inverterSize, "kW"))}
      ${createResultBlock("Annual energy", format(results.energy, "kWh/yr"))}
      ${createResultBlock("Simple payback", results.payback ? `${results.payback} years` : "Not reached")}
      <h4>25-year Cashflow</h4>
      ${results.cashflowTable}
      <h4>Calculation Steps</h4>
      ${formatSteps(results.steps)}
    `,
    );
    updateNotes(moduleId, [
      "Energy estimate uses PR and user-supplied yield or irradiation.",
      "Financials are simplified and do not include tax or financing.",
    ]);
  }

  pushRecent(moduleId, summary);
  renderDashboardLists();
  saveState();

  return { data, summary, snapshot };
};

const saveScenario = (moduleId) => {
  const result = calculateModule(moduleId);
  if (!result) return;
  const name = prompt("Scenario name?");
  if (!name) return;
  state.scenarios[moduleId].push({
    name,
    inputs: result.data,
    summary: result.summary,
    snapshot: result.snapshot,
  });
  saveState();
  renderScenarioPanel(moduleId);
};

const duplicateScenario = (moduleId) => {
  const result = calculateModule(moduleId);
  if (!result) return;
  const name = prompt("Duplicate scenario name?");
  if (!name) return;
  state.scenarios[moduleId].push({
    name,
    inputs: result.data,
    summary: result.summary,
    snapshot: result.snapshot,
  });
  saveState();
  renderScenarioPanel(moduleId);
};

const addFavorite = (moduleId, index) => {
  const scenario = state.scenarios[moduleId][index];
  if (!scenario) return;
  state.favorites.unshift({
    moduleId,
    summary: `${scenario.name}: ${scenario.summary}`,
  });
  state.favorites = state.favorites.slice(0, 6);
  saveState();
  renderDashboardLists();
};

const loadScenario = (moduleId, index) => {
  const scenario = state.scenarios[moduleId][index];
  if (!scenario) return;
  setFormValues(moduleId, scenario.inputs);
};

const deleteScenario = (moduleId, index) => {
  state.scenarios[moduleId].splice(index, 1);
  saveState();
  renderScenarioPanel(moduleId);
};

const handleReport = (moduleId) => {
  const data = getFormData(moduleId);
  const calculation = calculations[moduleId](data);
  if (calculation.errors) {
    alert("Please fix input errors before printing.");
    return;
  }
  reportWindow(moduleId, data, document.querySelector(`[data-results="${moduleId}"]`).innerHTML);
};

const exportAll = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ee-toolbox-projects.json";
  link.click();
  URL.revokeObjectURL(url);
};

const importAll = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Object.assign(state, data);
      saveState();
      renderScenarioPanel("conduit");
      renderScenarioPanel("vdrop");
      renderScenarioPanel("shortcircuit");
      renderScenarioPanel("pfc");
      renderScenarioPanel("powerquality");
      renderScenarioPanel("pv");
      renderDashboardLists();
      renderLibrary();
      renderSettings();
    } catch (error) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
};

const attachListeners = () => {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => showSection(link.dataset.section));
  });
  document.getElementById("toggleSidebar").addEventListener("click", toggleSidebar);

  document.querySelectorAll("[data-calc]").forEach((button) => {
    button.addEventListener("click", () => calculateModule(button.dataset.calc));
  });

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const moduleId = button.dataset.example;
      setFormValues(moduleId, exampleInputs[moduleId]);
    });
  });

  document.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => saveScenario(button.dataset.save));
  });

  document.querySelectorAll("[data-duplicate]").forEach((button) => {
    button.addEventListener("click", () => duplicateScenario(button.dataset.duplicate));
  });

  document.querySelectorAll("[data-compare]").forEach((button) => {
    button.addEventListener("click", () => renderComparePanel(button.dataset.compare));
  });

  document.querySelectorAll("[data-report]").forEach((button) => {
    button.addEventListener("click", () => handleReport(button.dataset.report));
  });

  document.getElementById("exportAll").addEventListener("click", exportAll);
  document.getElementById("importAll").addEventListener("change", importAll);

  document.getElementById("saveLibrary").addEventListener("click", saveLibrary);
  document.getElementById("resetLibrary").addEventListener("click", () => {
    state.library = structuredClone(DEFAULT_LIBRARY);
    renderLibrary();
    saveState();
  });

  document.getElementById("saveSettings").addEventListener("click", saveSettings);

  document.body.addEventListener("click", (event) => {
    const target = event.target;
    if (target.matches("[data-load]")) {
      loadScenario(target.dataset.load, Number(target.dataset.index));
    }
    if (target.matches("[data-favorite]")) {
      addFavorite(target.dataset.favorite, Number(target.dataset.index));
    }
    if (target.matches("[data-delete]")) {
      deleteScenario(target.dataset.delete, Number(target.dataset.index));
    }
    if (target.matches("[data-run-compare]")) {
      runCompare(target.dataset.runCompare);
    }
  });
};

const init = () => {
  loadState();
  renderModuleCards();
  renderDashboardLists();
  renderScenarioPanel("conduit");
  renderScenarioPanel("vdrop");
  renderScenarioPanel("shortcircuit");
  renderScenarioPanel("pfc");
  renderScenarioPanel("powerquality");
  renderScenarioPanel("pv");
  renderLibrary();
  renderSettings();
  attachListeners();
};

init();
