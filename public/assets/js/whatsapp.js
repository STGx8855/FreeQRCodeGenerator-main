/* public/assets/js/whatsapp.js
   WhatsApp static QR page:
   - combine country code + local number
   - validate inputs
   - message optional
   - generate QR (uses QRApp helpers in common.js)
   - same 3s placeholder animation
   - clears inputs after generate
*/

(function () {
  // tiny helpers
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  function markInvalid(el, msg) {
    if (window.QRApp && window.QRApp.markInvalid) return window.QRApp.markInvalid(el, msg);
    // fallback minimal
    if (!el) return;
    el.classList.add("invalid");
    const old = el.parentNode.querySelector(".error-msg");
    if (old) old.remove();
    const d = document.createElement("div");
    d.className = "error-msg";
    d.textContent = msg;
    el.parentNode.appendChild(d);
  }

  function clearInvalids() {
    if (window.QRApp && window.QRApp.clearInvalids) return window.QRApp.clearInvalids();
    document.querySelectorAll(".invalid").forEach(e => e.classList.remove("invalid"));
    document.querySelectorAll(".error-msg").forEach(e => e.remove());
  }

  function validateInputs() {
    clearInvalids();

    const codeEl = qs("#wa-code");
    const numEl = qs("#wa-number");

    const code = (codeEl && codeEl.value || "").trim();
    const num = (numEl && numEl.value || "").trim();

    if (!/^\+?\d{1,4}$/.test(code)) {
      markInvalid(codeEl, "Enter a valid country code like +91");
      return false;
    }

    if (!/^\d{6,15}$/.test(num)) {
      markInvalid(numEl, "Enter a valid local number (6–15 digits)");
      return false;
    }

    return true;
  }

  // build WA link in wa.me format (digits only, no plus)
  function buildWAData() {
    const codeEl = qs("#wa-code");
    const numEl = qs("#wa-number");
    const msgEl = qs("#wa-message");

    let codeRaw = (codeEl && codeEl.value || "").trim();
    let numRaw  = (numEl && numEl.value || "").trim();

    // digits only
    let codeDigits = codeRaw.replace(/\D/g, "");
    codeDigits = codeDigits.replace(/^0+/, ""); // strip leading zeros
    let numDigits = numRaw.replace(/\D/g, "");
    // if user pasted full international number into local, remove leading code digits if present
    if (codeDigits && numDigits.startsWith(codeDigits)) {
      numDigits = numDigits.slice(codeDigits.length);
    }
    numDigits = numDigits.replace(/^0+/, "");

    const fullNumber = `${codeDigits}${numDigits}`; // e.g. 919876543210

    const message = (msgEl && msgEl.value || "").trim();
    const query = message ? `?text=${encodeURIComponent(message)}` : "";

    return `https://wa.me/${fullNumber}${query}`;
  }

  // render QR instance into DOM and clear input(s) for next generation
  function renderQRToDOM(instance) {
    const wrapper = qs("#qrOutput");
    wrapper.innerHTML = "";
    instance.append(wrapper);
    wrapper.classList.add("visible");

    // show download/share
    const downloadWrapper = qs("#downloadWrapper");
    if (downloadWrapper) downloadWrapper.classList.remove("hidden");

    // scroll to show QR + buttons
    (downloadWrapper || wrapper).scrollIntoView({ behavior: "smooth", block: "center" });

    // Clear input values right after render so next generation starts fresh
    try {
      const codeEl = qs("#wa-code"); if (codeEl) codeEl.value = "+91";
      const numEl = qs("#wa-number"); if (numEl) numEl.value = "";
      const msgEl = qs("#wa-message"); if (msgEl) msgEl.value = "";

      // clear logo input UI if present
      const logoInput = qs("#logoUpload"); if (logoInput) { try { logoInput.value = ""; } catch(e){} }
      const nameEl = qs("#logoName"); if (nameEl) nameEl.textContent = "No file chosen";
      const clearBtn = qs("#logoClear"); if (clearBtn) clearBtn.classList.add("hidden");

      // remove any inline invalid state
      clearInvalids();
    } catch (e) { console.warn("clear after render:", e); }
  }

  // core generate using QRApp helper
  async function generateQRCore() {
    if (!validateInputs()) return false;

    const data = buildWAData();
    if (!data) return false;

    const styleBtn = document.querySelector(".style-btn.active");
    const style = styleBtn ? styleBtn.dataset.style || "basic" : "basic";
    const color = (qs("#colorPicker") && qs("#colorPicker").value) || "#00f2ff";
    const gradient = (qs("#gradientPicker") && qs("#gradientPicker").value) || "#ff00c8";

    const qrInstance = window.QRApp.createQRCodeInstance({ data, style, color, gradient, size: 300 });

    // logo handling (optional)
    const logoInput = qs("#logoUpload");
    const logoFile = logoInput && logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;
    if (logoFile) {
      try {
        const square = await window.QRApp.processLogoFileToSquare(logoFile, 120);
        if (square) qrInstance.update({ image: square });
      } catch (err) {
        console.error("logo error:", err);
      } finally {
        try { logoInput.value = ""; } catch (e) {}
        const nameEl = qs("#logoName"); if (nameEl) nameEl.textContent = "No file chosen";
        const clearBtn = qs("#logoClear"); if (clearBtn) clearBtn.classList.add("hidden");
      }
    }

    // render + hook buttons
    renderQRToDOM(qrInstance);
    qs("#btn-download").onclick = () => window.QRApp.downloadPNG(qrInstance, "qr-whatsapp");
    qs("#btn-share").onclick = () => window.QRApp.shareQR(qrInstance);

    return true;
  }

  // animation wrapper (3s placeholder)
  let isAnimating = false;
  function handleGenerateClick() {
    if (isAnimating) return;
    clearInvalids();

    // quick validation before animation
    if (!validateInputs()) return;

    isAnimating = true;
    const wrapper = qs("#qrOutput");
    const downloadWrapper = qs("#downloadWrapper");

    wrapper.classList.remove("visible");
    wrapper.innerHTML = "";
    if (downloadWrapper) downloadWrapper.classList.add("hidden");

    const placeholder = document.createElement("div");
    placeholder.className = "qr-placeholder";
    wrapper.appendChild(placeholder);
    wrapper.classList.add("visible");

    // smooth scroll so user sees animation
    wrapper.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(async () => {
      const ok = await generateQRCore();
      if (!ok) {
        wrapper.innerHTML = "";
        wrapper.classList.remove("visible");
        if (downloadWrapper) downloadWrapper.classList.add("hidden");
      }
      isAnimating = false;
    }, 3000);
  }

  // logo UI setup
  function setupLogoUI() {
    const realInput = qs("#logoUpload");
    const btn = qs("#logoBtn");
    const nameEl = qs("#logoName");
    const clearBtn = qs("#logoClear");
    if (!realInput || !btn || !nameEl || !clearBtn) return;

    btn.addEventListener("click", () => realInput.click());

    realInput.addEventListener("change", () => {
      if (realInput.files && realInput.files.length > 0) {
        const f = realInput.files[0];
        const displayName = f.name.length > 36 ? f.name.slice(0, 18) + "…" + f.name.slice(-12) : f.name;
        nameEl.textContent = displayName;
        clearBtn.classList.remove("hidden");
      } else {
        nameEl.textContent = "No file chosen";
        clearBtn.classList.add("hidden");
      }
    });

    clearBtn.addEventListener("click", () => {
      try { realInput.value = ""; } catch (e) {}
      nameEl.textContent = "No file chosen";
      clearBtn.classList.add("hidden");
    });
  }

  // style toggle
  function setupStyleToggle() {
    qsa(".style-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        qsa(".style-btn").forEach(b => b.classList.toggle("active", b === btn));
        const colorSection = qs("#color-section");
        if (btn.dataset.style === "colored") colorSection.classList.remove("hidden");
        else colorSection.classList.add("hidden");
      });
    });
  }

  // init bindings
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[whatsapp.js] loaded");
    setupLogoUI();
    setupStyleToggle();

    const gen = qs("#btn-generate");
    if (gen) gen.addEventListener("click", handleGenerateClick);

    // download/share initial (if user clicks before generation)
    const dl = qs("#btn-download");
    dl && (dl.onclick = () => alert("Generate a QR first."));

    const sh = qs("#btn-share");
    sh && (sh.onclick = () => alert("Generate a QR first."));
  });

})();
