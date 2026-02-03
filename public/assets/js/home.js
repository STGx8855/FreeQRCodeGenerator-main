/* public/assets/js/home.js — robust version with logs & delegation */

(function () {
  // Helpful startup log so you can check console if file ran
  console.log("[home.js] loaded");

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  // Utility to ensure a node is focusable and clickable with keyboard
  function makeAccessibleAsButton(el) {
    if (!el) return;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
  }

  // Simple URL validation (requires http/https)
  function validateUrlValue(url) {
    if (!url) return false;
    const re = /^(https?:\/\/).+/i;
    return re.test(url);
  }

  document.addEventListener("DOMContentLoaded", () => {
    console.log("[home.js] DOMContentLoaded");

    const choiceRoot = qs(".choose-root");
    const chooseDynamic = qs("#choose-dynamic");
    const chooseStatic = qs("#choose-static");
    const subtypePanel = qs("#subtypePanel");
    const subtypeDynamic = qs("#subtype-dynamic");
    const subtypeStatic = qs("#subtype-static");

    // Make tiles keyboard accessible (if not already)
    makeAccessibleAsButton(chooseDynamic);
    makeAccessibleAsButton(chooseStatic);

    // Hide subpanels initially
    if (subtypePanel) subtypePanel.classList.add("hidden");
    if (subtypeDynamic) subtypeDynamic.classList.add("hidden");
    if (subtypeStatic) subtypeStatic.classList.add("hidden");

    // Toggle handlers (click again to hide)
    if (chooseDynamic) {
      chooseDynamic.addEventListener("click", () => {
        const visible = !subtypePanel.classList.contains("hidden") && !subtypeDynamic.classList.contains("hidden");
        if (visible) {
          subtypePanel.classList.add("hidden");
          subtypeDynamic.classList.add("hidden");
        } else {
          subtypePanel.classList.remove("hidden");
          subtypeDynamic.classList.remove("hidden");
          subtypeStatic.classList.add("hidden");
          subtypePanel.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }

    if (chooseStatic) {
      chooseStatic.addEventListener("click", () => {
        const visible = !subtypePanel.classList.contains("hidden") && !subtypeStatic.classList.contains("hidden");
        if (visible) {
          subtypePanel.classList.add("hidden");
          subtypeStatic.classList.add("hidden");
        } else {
          subtypePanel.classList.remove("hidden");
          subtypeStatic.classList.remove("hidden");
          subtypeDynamic.classList.add("hidden");
          subtypePanel.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }

    // Event delegation for subtype buttons
    if (subtypePanel) {
      subtypePanel.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".subtype-btn");
        if (!btn) return;
        ev.preventDefault();
        const staticType = btn.dataset.type;
        const dynamicSub = btn.dataset.sub;
        if (staticType) {
          window.location.href = `static/${staticType}.html`;
          return;
        }
        if (dynamicSub) {
          alert("Dynamic flow '" + dynamicSub + "' is planned — backend coming soon.");
          return;
        }
      });
    }

    // ================== Instant URL QR Handlers ==================
    const instantInput = qs("#instant-input-url");
    const instantPasteBtn = qs("#instant-btn-paste");
    const instantGenBtn = qs("#instant-btn-generate");
    const instantQrOutput = qs("#instant-qrOutput");
    const instantDownloadWrapper = qs("#instant-downloadWrapper");
    const instantDownloadBtn = qs("#instant-btn-download");
    const instantShareBtn = qs("#instant-btn-share");
    const instantAddPhotoBtn = qs("#instant-addphoto-btn");
    const instantLogoInput = qs("#instant-logoUpload");
    // Ensure clicking the visible "Add Photo" button opens the hidden file picker
if (instantAddPhotoBtn && instantLogoInput) {
  instantAddPhotoBtn.addEventListener("click", (e) => {
    // prevent double action if animating
    if (instantAnimating) return;
    try {
      instantLogoInput.click();
    } catch (err) {
      console.warn("Could not open file picker:", err);
    }
  });
}

    const instantLogoName = qs("#instant-logoName");

    const instantStyleBasic = qs("#instant-style-basic");
    const instantStyleColored = qs("#instant-style-colored");
    const instantColorSection = qs("#instant-color-section");
    const instantColorPicker = qs("#instant-colorPicker");
    const instantGradientPicker = qs("#instant-gradientPicker");

    let instantQrInstance = null;
    let instantAnimating = false;

    // Paste button
    if (instantPasteBtn && instantInput) {
      instantPasteBtn.addEventListener("click", async () => {
        if (!navigator.clipboard || !window.isSecureContext) {
          instantInput.focus();
          return;
        }
        try {
          const text = await navigator.clipboard.readText();
          if (text) instantInput.value = text;
        } catch (err) {
          console.warn("Clipboard read failed", err);
          instantInput.focus();
        }
      });
    }

    // style toggles & live updates
    [instantStyleBasic, instantStyleColored].forEach(btn => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        [instantStyleBasic, instantStyleColored].forEach(b => b && b.classList.toggle("active", b === btn));
        if (btn.dataset.style === "colored") instantColorSection.classList.remove("hidden");
        else instantColorSection.classList.add("hidden");

        // live update if already generated
        if (instantQrInstance && window.QRApp && window.QRApp.updateInstanceStyle) {
          const style = btn.dataset.style || "basic";
          const color = (instantColorPicker && instantColorPicker.value) || "#00f2ff";
          const gradient = (instantGradientPicker && instantGradientPicker.value) || "#ff00c8";
          window.QRApp.updateInstanceStyle(instantQrInstance, { style, color, gradient });
        }
      });
    });

    [instantColorPicker, instantGradientPicker].forEach(el => {
      if (!el) return;
      el.addEventListener("input", () => {
        if (!instantQrInstance) return;
        const styleBtn = (instantStyleColored && instantStyleColored.classList.contains("active")) ? instantStyleColored : instantStyleBasic;
        const style = styleBtn ? styleBtn.dataset.style || "basic" : "basic";
        const color = (instantColorPicker && instantColorPicker.value) || "#00f2ff";
        const gradient = (instantGradientPicker && instantGradientPicker.value) || "#ff00c8";
        if (window.QRApp && window.QRApp.updateInstanceStyle) {
          window.QRApp.updateInstanceStyle(instantQrInstance, { style, color, gradient });
        }
      });
    });

    // generate handler (placeholder animation then create QR)
    async function instantGenerateHandler() {
      if (instantAnimating) return;
      if (window.QRApp && window.QRApp.clearInvalids) window.QRApp.clearInvalids();

      const url = (instantInput && instantInput.value || "").trim();
      if (!validateUrlValue(url)) {
        if (window.QRApp && window.QRApp.markInvalid) window.QRApp.markInvalid(instantInput, "Enter a valid URL starting with http:// or https://");
        return;
      }

      instantAnimating = true;

      // clear old
      if (instantQrOutput) {
        instantQrOutput.classList.remove("visible");
        instantQrOutput.innerHTML = "";
      }
      if (instantDownloadWrapper) instantDownloadWrapper.classList.add("hidden");

      // placeholder centered
      const placeholder = document.createElement("div");
      placeholder.className = "qr-placeholder";
      if (instantQrOutput) instantQrOutput.appendChild(placeholder);
      if (instantQrOutput) instantQrOutput.classList.add("visible");

      // scroll into view
      try {
        if (window.QRApp && window.QRApp.scrollTo) window.QRApp.scrollTo(instantQrOutput);
        else instantQrOutput.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (e) {}

      // after 2s create QR
      setTimeout(async () => {
        try {
          const styleBtn = (instantStyleColored && instantStyleColored.classList.contains("active")) ? instantStyleColored : instantStyleBasic;
          const style = styleBtn ? styleBtn.dataset.style || "basic" : "basic";
          const color = (instantColorPicker && instantColorPicker.value) || "#00f2ff";
          const gradient = (instantGradientPicker && instantGradientPicker.value) || "#ff00c8";

          instantQrInstance = QRApp.createQRCodeInstance({ data: url, style, color, gradient, size: 260 });

          // render and center
          QRApp.renderInstanceTo(instantQrInstance, "#instant-qrOutput", "#instant-downloadWrapper");

          // show Add Photo (label) and wire file input
          if (instantAddPhotoBtn) {
            instantAddPhotoBtn.style.display = "inline-flex";
            // set default text to Add Photo (in case it was changed earlier)
            instantAddPhotoBtn.textContent = "Add Photo";
          }
          if (instantLogoName) { instantLogoName.style.display = "none"; instantLogoName.textContent = "No file chosen"; }

          // hook download/share
          if (instantDownloadBtn) instantDownloadBtn.onclick = () => QRApp.downloadPNG(instantQrInstance, "qr-instant-url");
          if (instantShareBtn) instantShareBtn.onclick = () => QRApp.shareQR(instantQrInstance);

          // after render, clear input field
          try { instantInput.value = ""; } catch (e) {}

        } catch (err) {
          console.error("instant generate error:", err);
          if (instantQrOutput) { instantQrOutput.innerHTML = ""; instantQrOutput.classList.remove("visible"); }
          if (instantDownloadWrapper) instantDownloadWrapper.classList.add("hidden");
        } finally {
          instantAnimating = false;
        }
      }, 2000);
    }

    if (instantGenBtn) instantGenBtn.addEventListener("click", instantGenerateHandler);
    if (instantInput) instantInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); instantGenerateHandler(); } });

    // Add Photo: open file selector (label triggers hidden input). When file chosen -> process + update QR image instantly
    if (instantLogoInput) {
      instantLogoInput.addEventListener("change", async () => {
        const file = instantLogoInput.files && instantLogoInput.files[0] ? instantLogoInput.files[0] : null;
        if (!file) return;
        try {
          // show a short "processing" state in UI
          if (instantLogoName) { instantLogoName.style.display = "block"; instantLogoName.textContent = "Processing..."; }

          const squareDataUrl = await QRApp.processLogoFileToSquare(file, 140);
          if (squareDataUrl && instantQrInstance) {
            // apply image instantly
            QRApp.updateInstanceImage(instantQrInstance, squareDataUrl);
            // update filename UI
            if (instantLogoName) {
              const displayName = file.name.length > 36 ? file.name.slice(0, 18) + "…" + file.name.slice(-12) : file.name;
              instantLogoName.textContent = displayName;
            }
            // *** IMPORTANT: change the Add Photo button label to "Change Photo" when image added successfully
            // update Add/Change Photo button label + class
try {
  if (instantAddPhotoBtn) {
    instantAddPhotoBtn.textContent = "Change Photo";
    instantAddPhotoBtn.classList.add("has-photo");
    // keep button visible near download/share area (if you hide/show wrappers)
    instantAddPhotoBtn.style.display = "inline-flex";
  }
} catch (e) { /* ignore UI update errors */ }

          }
        } catch (err) {
          console.error("instant add photo failed:", err);
          if (instantLogoName) instantLogoName.textContent = "Failed to process image";
        }
      });
    }

  });
})();
