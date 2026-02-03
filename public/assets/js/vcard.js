/* public/assets/js/vcard.js
   Page-specific logic for static/vcard.html
   - Build vCard payload
   - Validate at least one contact field
   - Logo upload processing (square)
   - Placeholder animation + render
*/

(function () {
  let qrInstance = null;
  let isAnimating = false;

  function qs(s) { return document.querySelector(s); }
  function qsa(s) { return Array.from(document.querySelectorAll(s)); }

  // Validation: need at least one of name / phone / email
  function validateForm() {
    const name = (qs("#vc-name") && qs("#vc-name").value || "").trim();
    const code = (qs("#vc-code") && qs("#vc-code").value || "").trim();
    const phone = (qs("#vc-phone") && qs("#vc-phone").value || "").trim();
    const email = (qs("#vc-email") && qs("#vc-email").value || "").trim();

    if (!name && !phone && !email) {
      // mark the name field (primary) with error message
      const el = qs("#vc-name");
      window.QRApp && window.QRApp.markInvalid(el, "Enter at least one of Name, Phone or Email");
      return false;
    }

    // if phone present, do a lightweight phone validation
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 6 || digits.length > 15) {
        window.QRApp && window.QRApp.markInvalid(qs("#vc-phone"), "Enter a valid phone (6–15 digits)");
        return false;
      }
    }

    // email if present
    if (email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) {
        window.QRApp && window.QRApp.markInvalid(qs("#vc-email"), "Enter a valid email");
        return false;
      }
    }

    return true;
  }

  // build vCard (text version)
  function buildVCard() {
    if (!validateForm()) return null;

    const name = (qs("#vc-name") && qs("#vc-name").value || "").trim();
    const codeRaw = (qs("#vc-code") && qs("#vc-code").value || "").trim();
    const phoneRaw = (qs("#vc-phone") && qs("#vc-phone").value || "").trim();
    const email = (qs("#vc-email") && qs("#vc-email").value || "").trim();
    const org = (qs("#vc-org") && qs("#vc-org").value || "").trim();

    // normalize phone: combine code + local, but ensure no duplication
    let phoneDigits = phoneRaw.replace(/\D/g, "");
    let codeDigits = codeRaw.replace(/\D/g, "");
    codeDigits = codeDigits.replace(/^0+/, "");

    // if the local number already starts with the country code, strip it
    if (codeDigits && phoneDigits.startsWith(codeDigits)) {
      phoneDigits = phoneDigits.slice(codeDigits.length);
    }
    phoneDigits = phoneDigits.replace(/^0+/, "");

    let fullPhone = "";
    if (codeDigits || phoneDigits) {
      fullPhone = "+" + (codeDigits || "") + (phoneDigits || "");
    }

    // vCard 3.0 text
    let v = "BEGIN:VCARD\nVERSION:3.0\n";
    if (name) {
      v += `FN:${name}\n`;
      v += `N:${name};;;;\n`;
    }
    if (fullPhone) v += `TEL;TYPE=CELL:${fullPhone}\n`;
    if (email) v += `EMAIL;TYPE=INTERNET:${email}\n`;
    if (org) v += `ORG:${org}\n`;
    v += "END:VCARD";
    return v;
  }

  // render QR instance to DOM and clear inputs (but not the QR)
  function renderQRToDOM(instance) {
    const wrapper = qs("#qrOutput");
    wrapper.innerHTML = "";
    instance.append(wrapper);
    wrapper.classList.add("visible");

    // clear inputs (but keep QR)
    try {
      const name = qs("#vc-name"); if (name) name.value = "";
      const code = qs("#vc-code"); if (code) code.value = "+91";
      const phone = qs("#vc-phone"); if (phone) phone.value = "";
      const email = qs("#vc-email"); if (email) email.value = "";
      const org = qs("#vc-org"); if (org) org.value = "";

      // remove validation
      window.QRApp && window.QRApp.clearInvalids && window.QRApp.clearInvalids();

      // reset logo UI (if present)
      const logoInput = qs("#logoUpload");
      if (logoInput) try { logoInput.value = ""; } catch(e){}
      const nameEl = qs("#logoName"); if (nameEl) nameEl.textContent = "No file chosen";
      const clearBtn = qs("#logoClear"); if (clearBtn) clearBtn.classList.add("hidden");
    } catch (e) {
      console.warn("vcard: failed to clear inputs after render", e);
    }

    // show download/share buttons
    const downloadWrapper = qs("#downloadWrapper");
    if (downloadWrapper) downloadWrapper.classList.remove("hidden");

    (downloadWrapper || wrapper).scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // create QR instance, handle optional logo, then render
  async function generateQRCore() {
    const data = buildVCard();
    if (!data) return false;

    const styleBtn = qs(".style-btn.active");
    const style = styleBtn ? styleBtn.dataset.style || "basic" : "basic";
    const color = (qs("#colorPicker") && qs("#colorPicker").value) || "#00f2ff";
    const gradient = (qs("#gradientPicker") && qs("#gradientPicker").value) || "#ff00c8";

    // create qr instance via shared helper
    qrInstance = window.QRApp.createQRCodeInstance({ data, style, color, gradient, size: 300 });

    // logo
    const logoInput = qs("#logoUpload");
    const logoFile = logoInput && logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;
    if (logoFile) {
      try {
        const squareDataUrl = await window.QRApp.processLogoFileToSquare(logoFile, 120);
        if (squareDataUrl) qrInstance.update({ image: squareDataUrl });
      } catch (err) {
        console.error("vcard logo processing:", err);
      } finally {
        try { logoInput.value = ""; } catch(e){}
        const nameEl = qs("#logoName"); if (nameEl) nameEl.textContent = "No file chosen";
        const clearBtn = qs("#logoClear"); if (clearBtn) clearBtn.classList.add("hidden");
      }
    }

    renderQRToDOM(qrInstance);

    // hook download/share
    const dl = qs("#btn-download");
    if (dl) dl.onclick = () => window.QRApp.downloadPNG(qrInstance, "qr-vcard");
    const sh = qs("#btn-share");
    if (sh) sh.onclick = () => window.QRApp.shareQR(qrInstance);

    return true;
  }

  // animation wrapper
  function handleGenerateClick() {
    if (isAnimating) return;

    // clear old validation
    window.QRApp && window.QRApp.clearInvalids && window.QRApp.clearInvalids();

    if (!validateForm()) return;

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
      const ok = await generateQRCore();
      if (!ok) {
        wrapper.innerHTML = "";
        wrapper.classList.remove("visible");
        if (downloadWrapper) downloadWrapper.classList.add("hidden");
      }
      isAnimating = false;
    }, 3000);
  }

  // logo UI (same as other pages)
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

  // initial
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[vcard.js] loaded");
    setupLogoUI();
    setupStyleToggle();

    const gen = qs("#btn-generate");
    if (gen) gen.addEventListener("click", handleGenerateClick);

    // generic download/share handlers (use current instance)
    const dl = qs("#btn-download");
    if (dl) dl.onclick = () => { if (qrInstance) window.QRApp.downloadPNG(qrInstance); else alert("Generate a QR first."); };
    const sh = qs("#btn-share");
    if (sh) sh.onclick = () => { if (qrInstance) window.QRApp.shareQR(qrInstance); else alert("Generate a QR first."); };
  });

})();
