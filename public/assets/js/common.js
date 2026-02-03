/* public/assets/js/common.js
   Shared helpers for the QR Platform
   - QR instance creation (qr-code-styling)
   - logo processing (square)
   - download/share helpers
   - small DOM utilities
   Exposes window.QRApp
*/

(function (global) {
  const QRApp = {};

  /* ===== validation helpers (simple DOM helpers) ===== */
  QRApp.markInvalid = function (element, message) {
    if (!element) return;

    // highlight the input
    element.classList.add("invalid");

    // Find the nearest .section wrapper so the error appears BELOW the whole row
    let section = element.closest(".section");
    if (!section) section = element.parentNode;

    // remove any existing error message inside that section
    const old = section.querySelector(".error-msg");
    if (old) old.remove();

    // create new error message element
    const msg = document.createElement("div");
    msg.className = "error-msg";
    msg.textContent = message;

    // append message at the bottom of the section so input doesn't shrink
    section.appendChild(msg);

    try { element.focus(); } catch (e) {}
  };

  QRApp.clearInvalids = function () {
    document.querySelectorAll(".invalid").forEach(e => e.classList.remove("invalid"));
    document.querySelectorAll(".error-msg").forEach(e => e.remove());
  };

  /* ===== logo -> 1:1 square PNG dataURL ===== */
  QRApp.processLogoFileToSquare = function (file, size = 140) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      const img = new Image();

      reader.onload = function (e) {
        img.onload = function () {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, size, size);

            const iw = img.width, ih = img.height;
            const scale = Math.max(size / iw, size / ih);
            const nw = iw * scale, nh = ih * scale;
            const dx = (size - nw) / 2, dy = (size - nh) / 2;
            ctx.drawImage(img, dx, dy, nw, nh);

            const dataUrl = canvas.toDataURL("image/png");
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = function (err) { reject(err); };
        img.src = e.target.result;
      };

      reader.onerror = function (err) { reject(err); };
      reader.readAsDataURL(file);
    });
  };

  /* ===== QRCodeStyling wrapper ===== */
    QRApp.createQRCodeInstance = function ({ data, style = "basic", color = "#000000", gradient = "#ff00c8", image = null, size = 260 }) {
    const gradientOptions = style === "colored" ? {
      type: "linear",
      rotation: 0,
      colorStops: [{ offset: 0, color }, { offset: 1, color: gradient }]
    } : null;

    const dotsColor = style === "colored" ? color : "#000000";
    const bgColor = style === "colored" ? "#020617" : "#ffffff";

    const instance = new QRCodeStyling({
      width: size,
      height: size,
      data,
      dotsOptions: { type: "rounded", color: dotsColor, gradient: gradientOptions },
      backgroundOptions: { color: bgColor },
      cornersSquareOptions: { type: "dot", color: dotsColor },
      cornersDotOptions: { color: dotsColor },
      // reduce margin so logo and QR remain inside the square nicely
      imageOptions: { crossOrigin: "anonymous", margin: 4 }
    });

    if (image) instance.update({ image });
    return instance;
  

  };

  /* ===== update style/color on an existing QR instance immediately ===== */
  QRApp.updateInstanceStyle = function (instance, { style = "basic", color = "#000000", gradient = "#ff00c8" } = {}) {
    if (!instance) return;
    const gradientOptions = (style === "colored") ? {
      type: "linear",
      rotation: 0,
      colorStops: [{ offset: 0, color }, { offset: 1, color: gradient }]
    } : null;

    const dotsColor = (style === "colored") ? color : "#000000";
    const bgColor = (style === "colored") ? "#020617" : "#ffffff";

    try {
      instance.update({
        dotsOptions: { type: "rounded", color: dotsColor, gradient: gradientOptions },
        backgroundOptions: { color: bgColor },
        cornersSquareOptions: { type: "dot", color: dotsColor },
        cornersDotOptions: { color: dotsColor }
      });
    } catch (e) {
      console.warn("updateInstanceStyle failed:", e);
    }
  };

  /* ===== update image on existing QR instance (instant) ===== */
  QRApp.updateInstanceImage = function (instance, imageDataUrl) {
    if (!instance) return;
    try {
      instance.update({ image: imageDataUrl });
    } catch (e) {
      console.warn("updateInstanceImage failed:", e);
    }
  };

  /* ===== small render helper ===== */
  QRApp.renderInstanceTo = function (instance, containerSelector, downloadWrapperSelector) {
    if (!instance || !containerSelector) return;
    const container = (typeof containerSelector === "string") ? document.querySelector(containerSelector) : containerSelector;
    if (!container) return;

    // clear previous
    container.innerHTML = "";
    // ensure the wrapper centers the QR (CSS handles centering)
    instance.append(container);
    container.classList.add("visible");

    const downloadWrapper = downloadWrapperSelector ? ((typeof downloadWrapperSelector === "string") ? document.querySelector(downloadWrapperSelector) : downloadWrapperSelector) : null;
    if (downloadWrapper) downloadWrapper.classList.remove("hidden");

    (downloadWrapper || container).scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ===== download & share helpers ===== */
  QRApp.downloadPNG = function (qrInstance, filename = "qr-code.png") {
    if (!qrInstance) { alert("Generate a QR first."); return; }
    try { qrInstance.download({ extension: "png", name: filename.replace(/\..+$/, "") }); }
    catch (e) { alert("Download failed: " + (e.message || e)); }
  };

  QRApp.shareQR = async function (qrInstance) {
    if (!qrInstance) { alert("Generate a QR first."); return; }
    if (!navigator.share || !navigator.canShare) {
      alert("Sharing is not supported on this browser. Please download and share manually.");
      return;
    }
    try {
      let blob = null;
      if (qrInstance.getRawData) {
        blob = await qrInstance.getRawData("png");
      } else {
        const canvas = document.querySelector("#qrOutput canvas") || document.querySelector("#instant-qrOutput canvas");
        if (!canvas) throw new Error("No QR canvas found");
        const data = canvas.toDataURL();
        const res = await fetch(data);
        blob = await res.blob();
      }
      const file = new File([blob], "qr-code.png", { type: "image/png" });
      if (!navigator.canShare({ files: [file] })) { alert("Your device cannot share files directly."); return; }
      await navigator.share({ files: [file], title: "QR Code", text: "Here is your QR code." });
    } catch (err) {
      console.error(err);
      alert("Couldn't open share sheet. You can still download the QR.");
    }
  };

  /* ===== small DOM helpers ===== */
  QRApp.scrollTo = function (el) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  QRApp.resetCommonUI = function () {
    QRApp.clearInvalids();
    // logo UI
    const logoInput = document.getElementById("logoUpload");
    if (logoInput) logoInput.value = "";
    const nameEl = document.getElementById("logoName");
    if (nameEl) nameEl.textContent = "No file chosen";
    const clearBtn = document.getElementById("logoClear");
    if (clearBtn) clearBtn.classList.add("hidden");

    // style -> default basic
    document.querySelectorAll(".style-btn").forEach(b => b.classList.toggle("active", b.dataset.style === "basic"));
    const colorSection = document.getElementById("color-section");
    if (colorSection) colorSection.classList.add("hidden");
  };

  global.QRApp = QRApp;
})(window);
