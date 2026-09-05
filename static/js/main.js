document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("prediction-form");
  const submitBtn = document.getElementById("submit-btn");
  const resultCard = document.getElementById("result-card");
  const resultHigh = document.getElementById("result-high");
  const resultLow = document.getElementById("result-low");
  const probBar = document.getElementById("prob-bar");
  const probValue = document.getElementById("prob-value");
  const adviceHigh = document.getElementById("advice-high");
  const adviceLow = document.getElementById("advice-low");

  // Store last result for PDF
  window.lastResult = null;
  window.lastInputs = null;

  // ── BMI Calculator ───────────────────────────────────────────────────────
  const heightInput = document.getElementById("height");
  const weightInput = document.getElementById("weight");

  function calcBMI() {
    const h = parseFloat(heightInput.value);
    const w = parseFloat(weightInput.value);
    const bmiValueEl = document.getElementById("bmi-value");
    const bmiCategoryEl = document.getElementById("bmi-category");

    if (h > 0 && w > 0) {
      const hm = h / 100;
      const bmi = (w / (hm * hm)).toFixed(1);
      let cat = "",
        color = "";

      if (bmi < 18.5) {
        cat = "Underweight";
        color = "#2196F3";
      } else if (bmi < 25) {
        cat = "Normal ";
        color = "#4CAF50";
      } else if (bmi < 30) {
        cat = "Overweight ";
        color = "#FF9800";
      } else {
        cat = "Obese ";
        color = "#F44336";
      }

      bmiValueEl.textContent = bmi;
      bmiCategoryEl.textContent = cat;
      bmiCategoryEl.style.color = color;
    } else {
      bmiValueEl.textContent = "—";
      bmiCategoryEl.textContent = "";
    }
  }

  if (heightInput) heightInput.addEventListener("input", calcBMI);
  if (weightInput) weightInput.addEventListener("input", calcBMI);

  // ── Preview Inputs ────────────────────────────────────────────────────────
  window.previewInputs = function () {
    const previewSection = document.getElementById("preview-section");
    const summaryGrid = document.getElementById("summary-grid");

    const labels = {
      patient_name: "Patient Name",
      age: "Age (years)",
      sex: "Biological Sex",
      trestbps: "Resting BP (mm Hg)",
      thalach: "Max Heart Rate (bpm)",
      cp: "Chest Pain Type",
      chol: "Cholesterol (mg/dl)",
      fbs: "Fasting Blood Sugar",
      exang: "Exercise Angina",
      oldpeak: "ST Depression",
      slope: "ST Slope",
      restecg: "Resting ECG",
      ca: "Major Vessels",
      thal: "Thalassemia",
      height: "Height (cm)",
      weight: "Weight (kg)",
    };

    const selectLabels = {
      sex: { 0: "Female", 1: "Male" },
      cp: {
        1: "Typical Angina",
        2: "Atypical Angina",
        3: "Non-Anginal Pain",
        4: "Asymptomatic",
      },
      fbs: { 0: "No (≤120 mg/dl)", 1: "Yes (>120 mg/dl)" },
      exang: { 0: "No", 1: "Yes" },
      slope: { 1: "Upsloping", 2: "Flat", 3: "Downsloping" },
      restecg: { 0: "Normal", 1: "ST-T Abnormality", 2: "LV Hypertrophy" },
      ca: { 0: "0 vessels", 1: "1 vessel", 2: "2 vessels", 3: "3 vessels" },
      thal: { 3: "Normal", 6: "Fixed Defect", 7: "Reversible Defect" },
    };

    let html = "";
    let hasValues = false;

    Object.keys(labels).forEach((field) => {
      const el = document.getElementById(field);
      if (!el || !el.value) return;
      hasValues = true;
      let val = el.value;
      if (selectLabels[field] && selectLabels[field][val]) {
        val = selectLabels[field][val];
      }
      html += `
        <div class="summary-item">
          <span class="summary-label">${labels[field]}</span>
          <span class="summary-value">${val}</span>
        </div>`;
    });

    if (!hasValues) {
      showToast("error", "No Data", "Please fill in the form fields first.");
      return;
    }

    summaryGrid.innerHTML = html;
    previewSection.style.display = "block";
    previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(
      "low",
      "Preview Ready",
      "Please review your inputs then click Analyse.",
    );
  };

  // ── Form submit ──────────────────────────────────────────────────────────
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    resultCard.classList.add("result-card--hidden");

    // Save inputs for PDF
    window.lastInputs = {
      patient_name: document.getElementById("patient_name")?.value || "",
      age: document.getElementById("age")?.value || "",
      sex: document.getElementById("sex")?.value === "1" ? "Male" : "Female",
      trestbps: document.getElementById("trestbps")?.value || "",
      chol: document.getElementById("chol")?.value || "",
      thalach: document.getElementById("thalach")?.value || "",
      oldpeak: document.getElementById("oldpeak")?.value || "",
      height: document.getElementById("height")?.value || "",
      weight: document.getElementById("weight")?.value || "",
      bmi: document.getElementById("bmi-value")?.textContent || "—",
    };

    const formData = new FormData(form);

    fetch("/predict", { method: "POST", body: formData })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (data.error) {
          showToast("error", "Input Error", data.error);
          return;
        }
        showResult(data);
        loadHistory();
      })
      .catch((err) => {
        setLoading(false);
        showToast(
          "error",
          "Connection Error",
          "Something went wrong. Please try again.",
        );
        console.error(err);
      });
  });

  // ── Validate all fields ──────────────────────────────────────────────────
  function validateForm() {
    let valid = true;
    const required = form.querySelectorAll("[required]");
    required.forEach((input) => {
      input.classList.remove("error");
      if (!input.value || input.value === "") {
        input.classList.add("error");
        valid = false;
      }
    });
    if (!valid) {
      const firstError = form.querySelector(".error");
      if (firstError)
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast(
        "error",
        "Missing Fields",
        "Please fill in all required fields before submitting.",
      );
    }
    return valid;
  }

  // ── Show prediction result ───────────────────────────────────────────────
  function showResult(data) {
    const isHigh = data.prediction === 1;
    const prob = data.probability;
    const name = data.patient_name || "Patient";

    window.lastResult = data;

    // Show/hide banners and advice
    resultHigh.style.display = isHigh ? "flex" : "none";
    resultLow.style.display = isHigh ? "none" : "flex";
    adviceHigh.style.display = isHigh ? "block" : "none";
    adviceLow.style.display = isHigh ? "none" : "block";

    // Update patient name in result banner
    const verdictHigh = document.getElementById("verdict-high");
    const verdictLow = document.getElementById("verdict-low");
    if (verdictHigh)
      verdictHigh.textContent = `${name}  You have  Risk of Heart Disease`;
    if (verdictLow)
      verdictLow.textContent = `${name}  You have Risk of Heart Disease`;

    // Probability bar
    probBar.className =
      "prob-bar-fill " +
      (isHigh ? "prob-bar-fill--high" : "prob-bar-fill--low");
    probValue.textContent = prob + "%";

    // BMI result
    if (data.bmi) {
      const bmiWrap = document.getElementById("bmi-result-wrap");
      const bmiVal = document.getElementById("bmi-result-value");
      const bmiCat = document.getElementById("bmi-result-cat");
      if (bmiWrap) bmiWrap.style.display = "flex";
      if (bmiVal) bmiVal.textContent = data.bmi;
      if (bmiCat) bmiCat.textContent = data.bmi_category || "";
    }

    resultCard.classList.remove("result-card--hidden");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });

    setTimeout(() => {
      probBar.style.width = prob + "%";
    }, 100);

    // Confetti on low risk
    if (!isHigh) {
      launchConfetti();
    }

    // Toast notification
    if (isHigh) {
      showToast(
        "high",
        "High Risk Detected",
        `${name}  Probability: ${prob}%   Please refer to a cardiologist.`,
      );
    } else {
      showToast(
        "low",
        "Low Risk Detected",
        `${name}  Probability: ${prob}%   No significant indicators found.`,
      );
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────
  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Analysing...';
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        Analyse Heart Disease Risk`;
    }
  }

  // ── Clear errors on input change ─────────────────────────────────────────
  form.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("change", () => input.classList.remove("error"));
    input.addEventListener("input", () => input.classList.remove("error"));
  });

  // Load history on page start
  loadHistory();
});

// ── Reset form ────────────────────────────────────────────────────────────
function resetForm() {
  document.getElementById("prediction-form").reset();
  document.getElementById("result-card").classList.add("result-card--hidden");
  document.getElementById("prob-bar").style.width = "0%";
  document.getElementById("preview-section").style.display = "none";
  document.getElementById("bmi-value").textContent = "—";
  document.getElementById("bmi-category").textContent = "";
  const bmiWrap = document.getElementById("bmi-result-wrap");
  if (bmiWrap) bmiWrap.style.display = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── History Panel ─────────────────────────────────────────────────────────
function toggleHistory() {
  const panel = document.getElementById("history-panel");
  panel.classList.toggle("history-hidden");
  if (!panel.classList.contains("history-hidden")) {
    loadHistory();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function loadHistory() {
  fetch("/history")
    .then((res) => res.json())
    .then((data) => {
      const body = document.getElementById("history-body");
      if (!body) return;
      if (data.length === 0) {
        body.innerHTML =
          '<p class="history-empty">No predictions yet. Make your first prediction above.</p>';
        return;
      }
      let html = "";
      data
        .slice()
        .reverse()
        .forEach((record) => {
          const cls =
            record.risk_level === "HIGH" ? "history-high" : "history-low";
          const icon = record.risk_level === "HIGH" ? "H" : "L";
          html += `
          <div class="history-item ${cls}">
            <div class="history-left">
              <span class="history-icon">${icon}</span>
              <div>
                <div class="history-name">${record.name}</div>
                <div class="history-meta">Age: ${record.age} · ${record.sex} · ${record.date} ${record.time}</div>
              </div>
            </div>
            <div class="history-prob">${record.probability}%</div>
          </div>`;
        });
      body.innerHTML = html;
    })
    .catch((err) => console.error("History error:", err));
}

function clearHistory() {
  fetch("/clear-history", { method: "POST" }).then(() => {
    loadHistory();
    showToast(
      "low",
      "History Cleared",
      "All prediction records have been removed.",
    );
  });
}

// ── Download PDF Report ───────────────────────────────────────────────────
function downloadPDF() {
  if (!window.lastResult) {
    showToast("error", "No Result", "Please make a prediction first.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const res = window.lastResult;
  const inp = window.lastInputs || {};
  const name = res.patient_name || "Patient";
  const date = new Date().toLocaleDateString();
  const time = new Date().toLocaleTimeString();
  const isHigh = res.prediction === 1;

  // Header bar
  doc.setFillColor(12, 68, 124);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("HeartPredict  Heart Disease Risk Report", 105, 13, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Group 42 · BSc Computer Science · Final Year Project", 105, 23, {
    align: "center",
  });

  // Patient info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Information", 14, 44);
  doc.setDrawColor(12, 68, 124);
  doc.line(14, 46, 196, 46);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Patient Name : ${name}`, 14, 54);
  doc.text(`Age          : ${inp.age || "—"} years`, 14, 62);
  doc.text(`Sex          : ${inp.sex || "—"}`, 14, 70);
  doc.text(`Date         : ${date}`, 14, 78);
  doc.text(`Time         : ${time}`, 14, 86);
  if (inp.bmi && inp.bmi !== "—") {
    doc.text(`BMI          : ${inp.bmi}`, 14, 94);
  }

  // Result banner
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Prediction Result", 14, 108);
  doc.line(14, 110, 196, 110);

  if (isHigh) doc.setFillColor(163, 45, 45);
  else doc.setFillColor(15, 110, 86);
  doc.roundedRect(14, 114, 182, 22, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(
    isHigh
      ? "HIGH RISK  Heart Disease Indicators Detected"
      : "LOW RISK   No Significant Indicators Found",
    105,
    128,
    { align: "center" },
  );

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Probability  : ${res.probability}%`, 14, 148);
  doc.text("Model        : SVM (Support Vector Machine)", 14, 156);
  doc.text("Validation   : 5-Fold Stratified Cross-Validation", 14, 164);
  doc.text(
    "Dataset      : UCI Cleveland Heart Disease Dataset (302 records)",
    14,
    172,
  );

  // Clinical values
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Input Values", 14, 186);
  doc.line(14, 188, 196, 188);

  const rows = [
    ["Resting Blood Pressure", `${inp.trestbps || "—"} mm Hg`],
    ["Serum Cholesterol", `${inp.chol || "—"} mg/dl`],
    ["Maximum Heart Rate", `${inp.thalach || "—"} bpm`],
    ["ST Depression (Oldpeak)", `${inp.oldpeak || "—"}`],
  ];

  let y = 196;
  rows.forEach((row, i) => {
    doc.setFillColor(
      i % 2 === 0 ? 234 : 255,
      i % 2 === 0 ? 242 : 255,
      i % 2 === 0 ? 251 : 255,
    );
    doc.rect(14, y - 5, 182, 10, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(row[0], 18, y);
    doc.text(row[1], 150, y);
    y += 10;
  });

  // Recommendation
  y += 8;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Recommendation", 14, y);
  y += 4;
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const recs = isHigh
    ? [
        "• See a cardiologist urgently for further evaluation and diagnostic testing.",
        "• Take all prescribed medications as directed by your doctor.",
        "• Monitor blood pressure and heart rate daily and keep a record.",
        "• Reduce salt, saturated fats, and processed food intake.",
        "• Avoid strenuous exercise until cleared by a medical professional.",
        "• Stop smoking immediately and limit alcohol consumption.",
      ]
    : [
        "• Maintain a heart-healthy diet: fruits, vegetables, whole grains, fish, and nuts.",
        "• Exercise for at least 30 minutes, 5 days per week (walking, cycling, swimming).",
        "• Drink at least 8 glasses of water daily for healthy blood circulation.",
        "• Get 7 to 9 hours of quality sleep every night.",
        "• Manage stress through meditation, yoga, or deep breathing exercises.",
        "• Schedule annual health checkups to monitor your cardiovascular health.",
        "• Daily superfoods: oats, berries, garlic, green tea, dark chocolate (70%+).",
      ];

  recs.forEach((line) => {
    doc.text(line, 14, y);
    y += 8;
  });

  // Disclaimer
  y += 6;
  doc.setFillColor(241, 244, 246);
  doc.rect(14, y, 182, 18, "F");
  doc.setFontSize(8);
  doc.setTextColor(107, 124, 138);
  doc.text(
    "DISCLAIMER: This report is generated by an academic research prototype (Group 42 Final Year Project).",
    105,
    y + 6,
    { align: "center" },
  );
  doc.text(
    "It does not constitute medical advice and must not replace professional clinical diagnosis.",
    105,
    y + 12,
    { align: "center" },
  );

  doc.save(`HeartPredict_${name.replace(/ /g, "_")}_${date}.pdf`);
  showToast("low", "PDF Downloaded", `Report for ${name} saved successfully.`);
}

// ── Print Result ──────────────────────────────────────────────────────────
function printResult() {
  window.print();
  showToast("low", "Printing...", "Sending result to printer.");
}

// ── Confetti ──────────────────────────────────────────────────────────────
function launchConfetti() {
  const colors = [
    "#4CAF50",
    "#2196F3",
    "#FF9800",
    "#9C27B0",
    "#F44336",
    "#00BCD4",
    "#FFEB3B",
    "#0F6E56",
    "#185FA5",
  ];

  for (let i = 0; i < 120; i++) {
    setTimeout(() => {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const duration = 2.5 + Math.random() * 2;
      const size = 6 + Math.random() * 10;
      const shape = Math.random() > 0.5 ? "50%" : "2px";

      piece.style.cssText = `
        left: ${left}vw;
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: ${shape};
        animation-duration: ${duration}s;
      `;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), duration * 1000);
    }, i * 30);
  }
}

// ── Counter animation ─────────────────────────────────────────────────────
function animateCounter(element, target, duration, suffix) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    element.textContent = Math.floor(start) + (suffix || "");
  }, 16);
}

function startCounters() {
  document.querySelectorAll(".stat-num").forEach((counter) => {
    const target = counter.getAttribute("data-target");
    const suffix = counter.getAttribute("data-suffix") || "";
    if (target) {
      counter.textContent = "0" + suffix;
      animateCounter(counter, parseInt(target), 2000, suffix);
    }
  });
}

window.addEventListener("load", () => {
  setTimeout(startCounters, 300);
});

// ── Toast Notification ────────────────────────────────────────────────────
function showToast(type, title, message) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = { high: "H", low: "L", error: "X" };
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.style.position = "relative";
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || "ℹ"}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    <div class="toast-progress"></div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}


// ════════════════════════════════════════════════════════════════════════════
// BULK UPLOAD FEATURE — paste this at the bottom of your main.js
// ════════════════════════════════════════════════════════════════════════════

// Store selected file and bulk results
let selectedBulkFile   = null;
let bulkResultsData    = null;

// ── File drag and drop ────────────────────────────────────────────────────
function handleDrop(event) {
  event.preventDefault();
  const area = document.getElementById('upload-area');
  area.classList.remove('upload-area--drag');
  const file = event.dataTransfer.files[0];
  if (file) processFile(file);
}

// ── File browse select ────────────────────────────────────────────────────
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processFile(file);
}

// ── Process selected file ─────────────────────────────────────────────────
function processFile(file) {
  if (!file.name.endsWith('.csv')) {
    showToast('error', 'Wrong File Type', 'Please upload a CSV file only.');
    return;
  }

  selectedBulkFile = file;

  const selectedDiv = document.getElementById('upload-selected');
  selectedDiv.innerHTML = `
    <div class="file-selected">
      <span class="file-icon"><i class="fa-brands fa-shirtsinbulk"></i></span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${(file.size / 1024).toFixed(1)} KB</span>
      <button class="file-remove" onclick="removeFile()">✕</button>
    </div>
  `;

  document.getElementById('bulk-btn').disabled = false;
  showToast('low', 'File Ready', `${file.name} selected and  Run Bulk Prediction.`);
}

// ── Remove selected file ──────────────────────────────────────────────────
function removeFile() {
  selectedBulkFile = null;
  document.getElementById('upload-selected').innerHTML = '';
  document.getElementById('bulk-btn').disabled = true;
  document.getElementById('csv-file-input').value = '';
  document.getElementById('bulk-results').style.display = 'none';
}

// ── Submit bulk prediction ────────────────────────────────────────────────
function submitBulk() {
  if (!selectedBulkFile) {
    showToast('error', 'No File', 'Please select a CSV file first.');
    return;
  }

  const btn = document.getElementById('bulk-btn');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  const formData = new FormData();
  formData.append('csv_file', selectedBulkFile);

  fetch('/bulk-predict', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
      btn.disabled  = false;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        Run Bulk Prediction`;

      if (data.error) {
        showToast('error', 'Upload Error', data.error);
        return;
      }

      bulkResultsData = data;
      displayBulkResults(data);
      loadHistory();
      showToast('low', 'Bulk Complete', `${data.total} patients processed  ${data.high_count} high risk, ${data.low_count} low risk.`);
    })
    .catch(err => {
      btn.disabled  = false;
      btn.innerHTML = 'Run Bulk Prediction';
      showToast('error', 'Error', 'Something went wrong. Please try again.');
      console.error(err);
    });
}

// ── Display bulk results ──────────────────────────────────────────────────
function displayBulkResults(data) {
  const resultsDiv = document.getElementById('bulk-results');
  const summaryDiv = document.getElementById('bulk-summary');
  const tableBody  = document.getElementById('bulk-table-body');

  // Summary cards
  summaryDiv.innerHTML = `
    <div class="bulk-stat-card bulk-stat-total">
      <div class="bulk-stat-num">${data.total}</div>
      <div class="bulk-stat-label">Total Patients</div>
    </div>
    <div class="bulk-stat-card bulk-stat-low">
      <div class="bulk-stat-num">${data.low_count}</div>
      <div class="bulk-stat-label">Low Risk <i class="fa-solid fa-check"></i></div>
    </div>
    <div class="bulk-stat-card bulk-stat-high">
      <div class="bulk-stat-num">${data.high_count}</div>
      <div class="bulk-stat-label">High Risk <i class="fa-solid fa-circle-exclamation"></i></div>
    </div>
    <div class="bulk-stat-card bulk-stat-err">
      <div class="bulk-stat-num">${data.error_count}</div>
      <div class="bulk-stat-label">Errors <i class="fa-solid fa-xmark"></i></div>
    </div>
  `;

  // Table rows
  let rows = '';
  data.results.forEach(r => {
    const isHigh  = r.risk_level === 'HIGH';
    const isError = r.risk_level === 'ERROR';
    const riskBadge = isError
      ? `<span class="risk-badge risk-badge--error">ERROR</span>`
      : isHigh
        ? `<span class="risk-badge risk-badge--high">  HIGH</span>`
        : `<span class="risk-badge risk-badge--low">LOW</span>`;

    rows += `
      <tr class="${isHigh ? "row-high" : isError ? "row-error" : "row-low"}">
        <td>${r.row}</td>
        <td><strong>${r.patient_name}</strong></td>
        <td>${r.age}</td>
        <td>${r.sex}</td>
        <td>${riskBadge}</td>
        <td><strong>${r.probability}%</strong></td>
        <td>${
          isError
            ? `<span class="status-error" title="${r.error_msg || ""}">Failed</span>`
            : `<span class="status-ok">Success</span>`
        }</td>
<td>${
      isError
        ? `<span style="color:var(--gray-300)">—</span>`
        : `<button class="btn-patient-pdf"
       onclick='downloadPatientPDF(${JSON.stringify(r)})'>
      <i class="fa-solid fa-file-arrow-down"></i> Download
       </button>`
    }</td>
      </tr>`;
  });

  tableBody.innerHTML = rows;
  resultsDiv.style.display = 'block';
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Download results as CSV ───────────────────────────────────────────────
function downloadBulkCSV() {
  if (!bulkResultsData) {
    showToast('error', 'No Results', 'Please run a bulk prediction first.');
    return;
  }

  const rows = [
    ['#', 'Patient Name', 'Age', 'Sex', 'Risk Level', 'Probability (%)', 'Status']
  ];

  bulkResultsData.results.forEach(r => {
    rows.push([
      r.row,
      r.patient_name,
      r.age,
      r.sex,
      r.risk_level,
      r.probability,
      r.status
    ]);
  });

  const csvContent = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `HeartPredict_BulkResults_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('low', 'CSV Downloaded', 'Bulk results saved successfully.');
}

// ── Download CSV template ─────────────────────────────────────────────────
function downloadTemplate() {
  const headers = 'patient_name,age,sex,cp,trestbps,chol,fbs,restecg,thalach,exang,oldpeak,slope,ca,thal';
  const example1 = 'John Doe,63,1,4,145,233,1,2,150,0,2.3,3,0,6';
  const example2 = 'Jane Smith,54,0,2,130,204,0,0,172,0,1.4,2,0,3';
  const example3 = 'Bob Adams,41,1,3,130,214,0,0,168,0,2.0,2,4,3';
  const notes = [
    '',
    '# COLUMN GUIDE:',
    '# patient_name = Full name of patient',
    '# age          = Age in years (1-120)',
    '# sex          = 1=Male  0=Female',
    '# cp           = Chest pain: 1=Typical Angina  2=Atypical Angina  3=Non-Anginal  4=Asymptomatic',
    '# trestbps     = Resting blood pressure (mm Hg)',
    '# chol         = Serum cholesterol (mg/dl)',
    '# fbs          = Fasting blood sugar > 120: 1=Yes  0=No',
    '# restecg      = Resting ECG: 0=Normal  1=ST-T Abnormality  2=LV Hypertrophy',
    '# thalach      = Maximum heart rate achieved (bpm)',
    '# exang        = Exercise induced angina: 1=Yes  0=No',
    '# oldpeak      = ST depression (0.0 - 10.0)',
    '# slope        = ST slope: 1=Upsloping  2=Flat  3=Downsloping',
    '# ca           = Major vessels coloured (0-3)',
    '# thal         = Thalassemia: 3=Normal  6=Fixed Defect  7=Reversible Defect'
  ].join('\n');

  const csv  = [headers, example1, example2, example3, notes].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'HeartPredict_CSV_Template.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('low', 'Template Downloaded', 'Fill in the template and upload it back here.');
}

// ── Download individual patient PDF from bulk results ─────────────────────
function downloadPatientPDF(patient) {
  const { jsPDF } = window.jspdf;
  const doc    = new jsPDF();
  const isHigh = patient.risk_level === 'HIGH';
  const date   = new Date().toLocaleDateString();
  const time   = new Date().toLocaleTimeString();

  // ── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(12, 68, 124);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HeartPredict  Clinical Recommendation Report', 105, 13, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Group 42 · BSc Computer Science · Final Year Project', 105, 23, { align: 'center' });

  // ── Patient Info ──────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient Information', 14, 44);
  doc.setDrawColor(12, 68, 124);
  doc.line(14, 46, 196, 46);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient Name : ${patient.patient_name}`, 14, 54);
  doc.text(`Age          : ${patient.age} years`,    14, 62);
  doc.text(`Sex          : ${patient.sex}`,           14, 70);
  doc.text(`Report Date  : ${date}`,                  14, 78);
  doc.text(`Report Time  : ${time}`,                  14, 86);

  // ── Result Banner ─────────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Prediction Result', 14, 100);
  doc.line(14, 102, 196, 102);

  if (isHigh) doc.setFillColor(163, 45, 45);
  else        doc.setFillColor(15, 110, 86);
  doc.roundedRect(14, 106, 182, 22, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isHigh
      ? ' HIGH RISK    Heart Disease Indicators Detected'
      : 'LOW RISK    No Significant Indicators Found',
    105, 120, { align: 'center' }
  );

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Probability  : ${patient.probability}%`,                              14, 140);
  doc.text('Model        : Random Forest (Champion : F1: 89.05%, AUC: 95.10%)', 14, 148);
  doc.text('Validation   : 10-Fold Stratified Cross-Validation',                 14, 156);
  doc.text('Dataset      : UCI Cleveland Heart Disease Dataset (303 records)',   14, 164);

  // ── Clinical Recommendation ───────────────────────────────────────────────
  let y = 178;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Clinical Recommendation', 14, y);
  y += 4;
  doc.line(14, y, 196, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  if (isHigh) {
    // HIGH RISK header box
    doc.setFillColor(252, 235, 235);
    doc.rect(14, y - 4, 182, 14, 'F');
    doc.setTextColor(163, 45, 45);
    doc.setFont('helvetica', 'bold');
    doc.text('HIGH RISK  Seek for  Immediate Medical Attention Required', 18, y + 4);
    y += 18;

    const recs = [
      '1. See a cardiologist urgently for further evaluation and diagnostic testing.',
      '2. Take all prescribed medications as directed  never stop without doctor approval.',
      '3. Monitor blood pressure and heart rate daily and record the readings.',
      '4. Reduce salt, saturated fats, fried foods, and processed food intake immediately.',
      '5. Avoid all strenuous physical exercise until cleared by a medical professional.',
      '6. Stop smoking immediately and reduce or eliminate alcohol consumption.',
      '7. Attend all follow-up medical appointments without delay.',
      '8. Contact emergency services immediately if chest pain, dizziness, or breathlessness occurs.'
    ];

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    recs.forEach(rec => {
      doc.text(rec, 16, y);
      y += 9;
    });

  } else {
    // LOW RISK header box
    doc.setFillColor(240, 253, 244);
    doc.rect(14, y - 4, 182, 14, 'F');
    doc.setTextColor(15, 110, 86);
    doc.setFont('helvetica', 'bold');
    doc.text(' LOW RISK  Maintain Your Heart Health', 18, y + 4);
    y += 18;

    const recs = [
      '1. Eat a heart-healthy diet: fruits, vegetables, whole grains, fish, nuts, and olive oil.',
      '2. Exercise at least 30 minutes per day, 5 days per week (walking, cycling, swimming).',
      '3. Drink at least 8 glasses of water daily to support healthy blood circulation.',
      '4. Sleep 7 to 9 hours per night — poor sleep increases cardiovascular risk over time.',
      '5. Manage stress through meditation, deep breathing, yoga, or relaxation techniques.',
      '6. Schedule annual health checkups to monitor your cardiovascular health.',
      '7. Avoid smoking and limit alcohol consumption to protect your heart.',
      '8. Heart superfoods to include daily: oats, berries, garlic, green tea, dark chocolate (70%+).'
    ];

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    recs.forEach(rec => {
      doc.text(rec, 16, y);
      y += 9;
    });
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  y += 8;
  doc.setFillColor(241, 244, 246);
  doc.rect(14, y, 182, 18, 'F');
  doc.setFontSize(8);
  doc.setTextColor(107, 124, 138);
  doc.text(
    'DISCLAIMER: This report is generated by an academic research prototype (Group 42 Final Year Project).',
    105, y + 6, { align: 'center' }
  );
  doc.text(
    'It does not constitute medical advice and must not replace professional clinical diagnosis.',
    105, y + 12, { align: 'center' }
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  doc.save(`HeartPredict_${patient.patient_name.replace(/ /g, '_')}_Report.pdf`);
  showToast('low', 'PDF Downloaded', `Clinical report for ${patient.patient_name} saved.`);
}

// ── Tab Switcher ──────────────────────────────────────────────────────────
function switchTab(tab) {
  const singleContent = document.getElementById('single-tab-content');
  const bulkContent   = document.getElementById('bulk-tab-content');
  const singleBtn     = document.getElementById('tab-single');
  const bulkBtn       = document.getElementById('tab-bulk');

  if (tab === 'single') {
    singleContent.style.display = 'block';
    bulkContent.style.display   = 'none';
    singleBtn.classList.add('tab-btn--active');
    bulkBtn.classList.remove('tab-btn--active');
  } else {
    singleContent.style.display = 'none';
    bulkContent.style.display   = 'block';
    bulkBtn.classList.add('tab-btn--active');
    singleBtn.classList.remove('tab-btn--active');
  }

  // Scroll to top of main
  document.querySelector('.main').scrollIntoView({ behavior: 'smooth' });
}