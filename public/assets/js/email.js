/* public/assets/js/email.js
   Page logic for email.html:
   - validate email
   - build mailto: link with subject/body
   - generate QR (uses QRApp.createQRCodeInstance + processLogoFileToSquare)
   - placeholder animation, clear inputs after render
*/

(function () {
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  function markInvalid(el, msg) {
    if (window.QRApp && window.QRApp.markInvalid) return window.QRApp.markInvalid(el, msg);
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

  function validateEmailInput() {
    clearInvalids();
    const el = qs("#email-address");
    const val = (el && el.value || "").trim();
    if (!val) {
      markInvalid(el, "Email is required");
      return false;
    }
    // simple email regex
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(val)) {
      markInvalid(el, "Enter a valid email address");
      return false;
    }
    return true;
  }

  function buildMailto() {
    const to = (qs("#email-address") && qs("#email-address").value || "").trim();
    const subj = (qs("#email-subject") && qs("#email-subject").value || "").trim();
    const body = (qs("#email-body") && qs("#email-body").value || "").trim();

    if (!to) return null;
    const params = [];
    if (subj) params.push("subject=" + encodeURIComponent(subj));
    if (body) params.push("body=" + encodeURIComponent(body));
    const query = params.length ? "?" + params.join("&") : "";
    return `mailto:${to}${query}`;
  }

  // render + clear inputs
  function renderQRToDOM(instance) {
    const wrapper = qs("#qrOutput");
    wrapper.innerHTML = "";
    instance.append(wrapper);
    wrapper.classList.add("visible");

    const downloadWrapper = qs("#downloadWrapper");
    if (downloadWrapper) downloadWrapper.classList.remove("hidden");

    (downloadWrapper || wrapper).scrollIntoView({ behavior: "smooth", block: "center" });

    // clear fields for fresh start
    try {
      const addr = qs("#email-address"); if (addr) addr.value = "";
      const subj = qs("#email-subject"); if (subj) subj.value = "";
      const body = qs("#email-body"); if (body) body.value = "";

      const logoInput = qs("#logoUpload"); if (logoInput) { try { logoInput.value = ""; } catch(e){} }
      const nameEl = qs("#logoName"); if (nameEl) nameEl.textContent = "No file chosen";
      const clearBtn = qs("#logoClear"); if (clearBtn) clearBtn.classList.add("hidden");

      clearInvalids();
    } catch (e) { console.warn("clear after render:", e); }
  }

  async function generateCore() {
    if (!validateEmailInput()) return false;
    const data = buildMailto();
    if (!data) return false;

    const styleBtn = document.querySelector(".style-btn.active");
    const style = styleBtn ? styleBtn.dataset.style || "basic" : "basic";
    const color = (qs("#colorPicker") && qs("#colorPicker").value) || "#00f2ff";
    const gradient = (qs("#gradientPicker") && qs("#gradientPicker").value) || "#ff00c8";

    const qrInstance = window.QRApp.createQRCodeInstance({ data, style, color, gradient, size: 300 });

    // logo
    const logoInput = qs("#logoUpload");
    const logoFile = logoInput && logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;
    if (logoFile) {
      try {
        const square = await window.QRApp.processLogoFileToSquare(logoFile, 120);
        if (square) qrInstance.update({ image: square });
      } catch (err) {
        console.error("Logo process error:", err);
      } finally {
        try { logoInput.value = ""; } catch (e) {}
        const nameEl = qs("#logoName"); if (nameEl) nameEl.textContent = "No file chosen";
        const clearBtn = qs("#logoClear"); if (clearBtn) clearBtn.classList.add("hidden");
      }
    }

    // render and hook buttons
    renderQRToDOM(qrInstance);
    qs("#btn-download").onclick = () => window.QRApp.downloadPNG(qrInstance, "qr-email");
    qs("#btn-share").onclick = () => window.QRApp.shareQR(qrInstance);

    return true;
  }

  // animation wrapper
  let isAnimating = false;
  function handleGenerateClick() {
    if (isAnimating) return;
    clearInvalids();

    // quick validation before animation
    if (!validateEmailInput()) return;

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

    wrapper.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(async () => {
      const ok = await generateCore();
      if (!ok) {
        wrapper.innerHTML = "";
        wrapper.classList.remove("visible");
        if (downloadWrapper) downloadWrapper.classList.add("hidden");
      }
      isAnimating = false;
    }, 3000);
  }

  // logo UI
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

  document.addEventListener("DOMContentLoaded", () => {
    console.log("[email.js] loaded");
    setupLogoUI();
    setupStyleToggle();

    const gen = qs("#btn-generate");
    if (gen) gen.addEventListener("click", handleGenerateClick);

    // default download/share stubs until QR exists
    const dl = qs("#btn-download");
    dl && (dl.onclick = () => alert("Generate a QR first."));
    const sh = qs("#btn-share");
    sh && (sh.onclick = () => alert("Generate a QR first."));
  });

})();
