// ==================== CONFIGURATION ====================
const RAZORPAY_KEY = "rzp_test_YOUR_KEY_HERE"; // Replace with your Razorpay key

// Subscription Plans Configuration
const PLANS = {
  free: { name: "Free", scansLimit: 10, price: 0 },
  student: {
    name: "Student",
    scansLimit: 100,
    monthlyPrice: 99,
    yearlyPrice: 999,
  },
  professional: {
    name: "Professional",
    scansLimit: -1,
    monthlyPrice: 299,
    yearlyPrice: 2999,
  },
  business: {
    name: "Business",
    scansLimit: -1,
    monthlyPrice: 999,
    yearlyPrice: 9999,
  },
};

// ==================== STATE MANAGEMENT ====================
let currentPlan = localStorage.getItem("currentPlan") || "free";
let scansUsed = parseInt(localStorage.getItem("scansUsed")) || 0;
let documents = JSON.parse(localStorage.getItem("documents")) || [];
let stream = null;
let capturedImageData = null;

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", function () {
  updatePlanDisplay();
  loadDocuments();
  setupEventListeners();
  handleBillingToggle();
});

function setupEventListeners() {
  document
    .getElementById("startScanBtn")
    .addEventListener("click", openScanner);
  document
    .getElementById("upgradeBtn")
    .addEventListener("click", () => scrollToSection("pricing"));
  document
    .getElementById("billingToggle")
    .addEventListener("change", handleBillingToggle);

  // Navigation
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const section = this.getAttribute("href").substring(1);
      scrollToSection(section);
    });
  });
}

function scrollToSection(sectionId) {
  document.getElementById(sectionId).scrollIntoView({ behavior: "smooth" });
}

// ==================== PLAN MANAGEMENT ====================
function updatePlanDisplay() {
  const plan = PLANS[currentPlan];
  document.getElementById("planName").textContent = plan.name;

  if (plan.scansLimit === -1) {
    document.getElementById(
      "scansCount"
    ).textContent = `${scansUsed} (Unlimited)`;
  } else {
    document.getElementById(
      "scansCount"
    ).textContent = `${scansUsed}/${plan.scansLimit}`;
  }
}

function canScan() {
  const plan = PLANS[currentPlan];
  if (plan.scansLimit === -1) return true;
  return scansUsed < plan.scansLimit;
}

function incrementScanCount() {
  scansUsed++;
  localStorage.setItem("scansUsed", scansUsed);
  updatePlanDisplay();
}

// ==================== SUBSCRIPTION & PAYMENT ====================
function handleBillingToggle() {
  const isYearly = document.getElementById("billingToggle").checked;

  document.querySelectorAll(".monthly-price").forEach((el) => {
    el.style.display = isYearly ? "none" : "inline";
  });

  document.querySelectorAll(".yearly-price").forEach((el) => {
    el.style.display = isYearly ? "inline" : "none";
  });

  document.querySelectorAll(".yearly-total").forEach((el) => {
    el.style.display = isYearly ? "block" : "none";
  });

  // Update button onclick handlers
  updateSubscriptionButtons(isYearly);
}

function updateSubscriptionButtons(isYearly) {
  const period = isYearly ? "yearly" : "monthly";
  const buttons = document.querySelectorAll(
    ".pricing-card .btn-plan:not(:disabled)"
  );

  buttons.forEach((btn, index) => {
    const plans = ["student", "professional", "business"];
    const planName = plans[index];
    const price = isYearly
      ? PLANS[planName].yearlyPrice
      : PLANS[planName].monthlyPrice;
    btn.onclick = () => subscribeToPlan(planName, period, price);
  });
}

function subscribeToPlan(planName, billingCycle, amount) {
  const options = {
    key: RAZORPAY_KEY,
    amount: amount * 100, // Razorpay expects amount in paise
    currency: "INR",
    name: "DocuMind AI",
    description: `${PLANS[planName].name} Plan - ${billingCycle}`,
    image: "https://i.imgur.com/n5tjHFD.png",
    handler: function (response) {
      handlePaymentSuccess(response, planName, billingCycle);
    },
    prefill: {
      name: "",
      email: "",
      contact: "",
    },
    theme: {
      color: "#6C63FF",
    },
  };

  const razorpay = new Razorpay(options);

  razorpay.on("payment.failed", function (response) {
    alert("Payment failed: " + response.error.description);
  });

  razorpay.open();
}

function handlePaymentSuccess(response, planName, billingCycle) {
  currentPlan = planName;
  scansUsed = 0;

  localStorage.setItem("currentPlan", currentPlan);
  localStorage.setItem("scansUsed", scansUsed);
  localStorage.setItem("subscriptionId", response.razorpay_payment_id);
  localStorage.setItem("subscriptionDate", new Date().toISOString());

  updatePlanDisplay();

  alert(
    `✅ Payment Successful!\nPayment ID: ${response.razorpay_payment_id}\nYou're now on the ${PLANS[planName].name} plan!`
  );
}

// ==================== SCANNER FUNCTIONALITY ====================
function openScanner() {
  if (!canScan()) {
    showUpgradeModal();
    return;
  }

  document.getElementById("scannerModal").style.display = "block";
  resetScanner();
}

function closeScanner() {
  document.getElementById("scannerModal").style.display = "none";
  stopCamera();
}

function showUpgradeModal() {
  const upgrade = confirm(
    "You have reached your scan limit for this plan. Would you like to upgrade?"
  );
  if (upgrade) {
    scrollToSection("pricing");
  }
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    const video = document.getElementById("video");
    video.srcObject = stream;

    document.getElementById("captureBtn").disabled = false;
  } catch (err) {
    alert("Error accessing camera: " + err.message);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function captureImage() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);

  capturedImageData = canvas.toDataURL("image/png");

  document.getElementById("cameraView").style.display = "none";
  document.getElementById("capturedImage").style.display = "block";
  document.getElementById("scannedImg").src = capturedImageData;

  stopCamera();
  incrementScanCount();
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!canScan()) {
    showUpgradeModal();
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    capturedImageData = e.target.result;

    document.getElementById("cameraView").style.display = "none";
    document.getElementById("capturedImage").style.display = "block";
    document.getElementById("scannedImg").src = capturedImageData;

    incrementScanCount();
  };
  reader.readAsDataURL(file);
}

function resetScanner() {
  document.getElementById("cameraView").style.display = "block";
  document.getElementById("capturedImage").style.display = "none";
  document.getElementById("extractedText").style.display = "none";
  document.getElementById("ocrProgress").style.display = "none";
  capturedImageData = null;

  const video = document.getElementById("video");
  video.srcObject = null;
}

// ==================== OCR PROCESSING ====================
async function extractText() {
  if (!capturedImageData) return;

  // Check if premium feature
  if (currentPlan === "free") {
    alert(
      "Text extraction is available in Student plan and above. Please upgrade!"
    );
    scrollToSection("pricing");
    return;
  }

  const progressBar = document.getElementById("ocrProgress");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");

  progressBar.style.display = "block";
  document.getElementById("extractedText").style.display = "none";

  try {
    const worker = await Tesseract.createWorker({
      logger: (m) => {
        if (m.status === "recognizing text") {
          const progress = Math.round(m.progress * 100);
          progressFill.style.width = progress + "%";
          progressText.textContent = `Processing... ${progress}%`;
        }
      },
    });

    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const {
      data: { text },
    } = await worker.recognize(capturedImageData);

    await worker.terminate();

    progressBar.style.display = "none";
    document.getElementById("extractedText").style.display = "block";
    document.getElementById("textContent").textContent =
      text || "No text detected.";

    // Save extracted text with document
    saveDocument(capturedImageData, text);
  } catch (err) {
    alert("Error extracting text: " + err.message);
    progressBar.style.display = "none";
  }
}

function copyText() {
  const textContent = document.getElementById("textContent").textContent;
  navigator.clipboard.writeText(textContent).then(() => {
    alert("✅ Text copied to clipboard!");
  });
}

// ==================== PDF GENERATION ====================
function downloadPDF() {
  if (!capturedImageData) return;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  // Add watermark for free plan
  if (currentPlan === "free") {
    pdf.setFontSize(40);
    pdf.setTextColor(200, 200, 200);
    pdf.text("DocuMind AI", 105, 148, { align: "center", angle: 45 });
  }

  const img = document.getElementById("scannedImg");
  const imgWidth = 190;
  const imgHeight = (img.height * imgWidth) / img.width;

  pdf.addImage(capturedImageData, "PNG", 10, 10, imgWidth, imgHeight);
  pdf.save(`document_${Date.now()}.pdf`);

  alert("✅ PDF downloaded successfully!");
}

// ==================== DOCUMENT MANAGEMENT ====================
function saveDocument(imageData, extractedText = "") {
  const document = {
    id: Date.now(),
    image: imageData,
    text: extractedText,
    date: new Date().toISOString(),
    plan: currentPlan,
  };

  documents.unshift(document);
  localStorage.setItem("documents", JSON.stringify(documents));
  loadDocuments();
}

function loadDocuments() {
  const documentsList = document.getElementById("documentsList");

  if (documents.length === 0) {
    documentsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open fa-4x"></i>
                <p>No documents yet. Start scanning!</p>
            </div>
        `;
    return;
  }

  documentsList.innerHTML = documents
    .map(
      (doc) => `
        <div class="document-card">
            <img src="${doc.image}" alt="Document">
            <div class="document-info">
                <h4>Document #${doc.id}</h4>
                <p>${new Date(doc.date).toLocaleDateString()}</p>
                <p>Plan: ${PLANS[doc.plan].name}</p>
            </div>
            <div class="document-actions">
                <button onclick="viewDocument(${doc.id})" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="downloadDocument(${doc.id})" title="Download">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteDocument(${doc.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `
    )
    .join("");
}

function viewDocument(id) {
  const doc = documents.find((d) => d.id === id);
  if (!doc) return;

  capturedImageData = doc.image;
  document.getElementById("scannerModal").style.display = "block";
  document.getElementById("cameraView").style.display = "none";
  document.getElementById("capturedImage").style.display = "block";
  document.getElementById("scannedImg").src = doc.image;

  if (doc.text) {
    document.getElementById("extractedText").style.display = "block";
    document.getElementById("textContent").textContent = doc.text;
  }
}

function downloadDocument(id) {
  const doc = documents.find((d) => d.id === id);
  if (!doc) return;

  const link = document.createElement("a");
  link.href = doc.image;
  link.download = `document_${id}.png`;
  link.click();
}

function deleteDocument(id) {
  if (!confirm("Are you sure you want to delete this document?")) return;

  documents = documents.filter((d) => d.id !== id);
  localStorage.setItem("documents", JSON.stringify(documents));
  loadDocuments();
}

function clearAllDocuments() {
  if (!confirm("Are you sure you want to delete all documents?")) return;

  documents = [];
  localStorage.setItem("documents", JSON.stringify(documents));
  loadDocuments();
}

// Close modal when clicking outside
window.onclick = function (event) {
  const modal = document.getElementById("scannerModal");
  if (event.target === modal) {
    closeScanner();
  }
};
