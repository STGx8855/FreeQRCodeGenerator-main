/* public/assets/js/url.js
   Page-specific logic for static/url.html
   - Validate URL
   - Paste button
   - Generate animation (3s placeholder grow)
   - Use QRApp.createQRCodeInstance and QRApp.processLogoFileToSquare
   - Show download/share buttons
*/

(function () {
  // page state
  let qrInstance = null;
  let isAnimating = false;

  // small helper
  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return Array.from(document.querySelectorAll(selector)); }

  // validate URL (must start with http(s)://)
  function validateURLInput() {
    const input = qs("#input-url");
    const url = (input && input.value || "").trim();
    const re = /^(https?:\/\/).+/i;
    if (!re.test(url)) {
      window.QRApp && window.QRApp.markInvalid(input, "Enter a valid URL starting with http:// or https://");
      return null;
    }
    return url;
  }

  // build data for QR (just the URL)
  function buildData() {
    return validateURLInput();
  }

  // handle paste
  async function handlePasteClick() {
    const input = qs("#input-url");
    if (!navigator.clipboard || !window.isSecureContext) {
      input.focus();
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (text) input.value = text;
    } catch (e) {
      console.warn("Clipboard read failed", e);
      input.focus();
    }
  }

  // create QR and render into #qrOutput
  function renderQRToDOM(instance) {
    const wrapper = qs("#qrOutput");
    // replace previous QR with this one
    wrapper.innerHTML = "";
    instance.append(wrapper);
    wrapper.classList.add("visible");

    // *** CLEAR the URL input here so it's always emptied right after QR appears ***
    try {
      const urlInput = qs("#input-url");
      if (urlInput) {
        urlInput.value = "";
        // also remove any invalid state if present
        urlInput.classList.remove("invalid");
        const sec = urlInput.closest(".section");
        if (sec) {
          const oldErr = sec.querySelector(".error-msg");
          if (oldErr) oldErr.remove();
        }
      }
    } catch (e) {
      console.warn("Could not clear URL input after render:", e);
    }

    // Ensure download/share area is visible
    const downloadWrapper = qs("#downloadWrapper");
    if (downloadWrapper) downloadWrapper.classList.remove("hidden");

    // scroll so user sees QR + buttons
    if (downloadWrapper) {
      downloadWrapper.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // core generation logic (no animation)
  async function generateQRCore() {
    const data = buildData();
    if (!data) return false;

    const styleBtn = document.querySelector(".style-btn.active");
    const style = styleBtn ? styleBtn.dataset.style || "basic" : "basic";
    const color = (qs("#colorPicker") && qs("#colorPicker").value) || "#00f2ff";
    const gradient = (qs("#gradientPicker") && qs("#gradientPicker").value) || "#ff00c8";

    // create instance via shared helper
    qrInstance = window.QRApp.createQRCodeInstance({ data, style, color, gradient, size: 300 });

    // handle logo if present (process to square, then update QR)
    const logoInput = qs("#logoUpload");
    const logoFile = logoInput && logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;
    if (logoFile) {
      try {
        const squareDataUrl = await window.QRApp.processLogoFileToSquare(logoFile, 120);
        if (squareDataUrl) {
          // update QR instance to embed the logo
          qrInstance.update({ image: squareDataUrl });
        }
      } catch (err) {
        console.error("Logo processing error:", err);
        // fall through and render without logo
      } finally {
        // clear native file input so it doesn't persist between generations
        try { logoInput.value = ""; } catch (e) {}
        const nameEl = qs("#logoName");
        if (nameEl) nameEl.textContent = "No file chosen";
        const clearBtn = qs("#logoClear");
        if (clearBtn) clearBtn.classList.add("hidden");
      }
    }

    // render into DOM (this also clears the URL input inside renderQRToDOM)
    renderQRToDOM(qrInstance);

    // attach download/share handlers to current instance
    const dl = qs("#btn-download");
    if (dl) dl.onclick = () => window.QRApp.downloadPNG(qrInstance, "qr-url");
    const sh = qs("#btn-share");
    if (sh) sh.onclick = () => window.QRApp.shareQR(qrInstance);

    return true;
  }

  // placeholder grow animation then run core
  function handleGenerateClick() {
    if (isAnimating) return;

    // clear previous validation messages
    window.QRApp && window.QRApp.clearInvalids && window.QRApp.clearInvalids();

    // quick validation (validateURLInput will mark invalid if needed)
    if (!validateURLInput()) return;

    isAnimating = true;

    const wrapper = qs("#qrOutput");
    const downloadWrapper = qs("#downloadWrapper");

    // clear old preview but do NOT call global reset or clear downloadWrapper permanently
    wrapper.classList.remove("visible");
    wrapper.innerHTML = "";
    if (downloadWrapper) downloadWrapper.classList.add("hidden");

    // placeholder square (uses CSS animation .qr-placeholder / growSquare)
    const placeholder = document.createElement("div");
    placeholder.className = "qr-placeholder";
    wrapper.appendChild(placeholder);
    wrapper.classList.add("visible");

    // scroll into view
    wrapper.scrollIntoView({ behavior: "smooth", block: "center" });

    // after animation (3s) create actual QR
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

  // Logo custom UI handlers (mirrors common.js usage but local)
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

  // style toggle logic (show/hide color section)
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

  // setup paste button (uses QRApp handler code for clipboard)
  function setupPaste() {
    const pasteBtn = qs("#btn-paste");
    if (!pasteBtn) return;
    pasteBtn.addEventListener("click", handlePasteClick);
  }

  // initial bindings
  document.addEventListener("DOMContentLoaded", () => {
    // sanity
    console.log("[url.js] loaded");

    setupLogoUI();
    setupStyleToggle();
    setupPaste();

    const gen = qs("#btn-generate");
    if (gen) gen.addEventListener("click", handleGenerateClick);

    // download/share buttons (these will use the current qrInstance when clicked)
    const dl = qs("#btn-download");
    if (dl) dl.onclick = () => { if (qrInstance) window.QRApp.downloadPNG(qrInstance); else alert("Generate a QR first."); };

    const sh = qs("#btn-share");
    if (sh) sh.onclick = () => { if (qrInstance) window.QRApp.shareQR(qrInstance); else alert("Generate a QR first."); };
  });

})();
