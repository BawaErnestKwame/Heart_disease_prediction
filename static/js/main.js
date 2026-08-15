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

  // ── Form submit ─────────────────────────────────────────────────────────
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    resultCard.classList.add("result-card--hidden");

    const formData = new FormData(form);

    fetch("/predict", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (data.error) {
          showToast("error", "Input Error", data.error);
          return;
        }
        showResult(data);
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
    const inputs = form.querySelectorAll("input, select");
    inputs.forEach((input) => {
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

    resultHigh.style.display = isHigh ? "flex" : "none";
    resultLow.style.display = isHigh ? "none" : "flex";
    adviceHigh.style.display = isHigh ? "block" : "none";
    adviceLow.style.display = isHigh ? "none" : "block";

    probBar.className =
      "prob-bar-fill " +
      (isHigh ? "prob-bar-fill--high" : "prob-bar-fill--low");
    probValue.textContent = prob + "%";

    resultCard.classList.remove("result-card--hidden");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });

    setTimeout(() => {
      probBar.style.width = prob + "%";
    }, 100);

    // ── Show toast notification after prediction ──────────────────────────
    if (isHigh) {
      showToast(
        "high",
        "High Risk Detected",
        `Probability of heart disease: ${prob}% , Please refer to a cardiologist.`,
      );
    } else {
      showToast(
        "low",
        "Low Risk Detected",
        `Probability of heart disease: ${prob}% , No significant indicators found.`,
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
});

// ── Reset form (global — called from button onclick) ──────────────────────
function resetForm() {
  document.getElementById("prediction-form").reset();
  const resultCard = document.getElementById("result-card");
  resultCard.classList.add("result-card--hidden");
  document.getElementById("prob-bar").style.width = "0%";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Counter animation for hero stats ─────────────────────────────────────
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
  const counters = document.querySelectorAll(".stat-num");
  counters.forEach((counter) => {
    const target = counter.getAttribute("data-target");
    const suffix = counter.getAttribute("data-suffix") || "";
    const duration = 2000;
    if (target) {
      counter.textContent = "0" + suffix;
      animateCounter(counter, parseInt(target), duration, suffix);
    }
  });
}

// Start counting when page loads
window.addEventListener("load", () => {
  setTimeout(startCounters, 300);
});

// ── Toast Notification ────────────────────────────────────────────────────
function showToast(type, title, message) {
  // Create container if it doesn't exist
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = {
    high: "H",
    low: "L",
    error: "X",
  };

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.style.position = "relative";
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || "ℹ️"}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}
