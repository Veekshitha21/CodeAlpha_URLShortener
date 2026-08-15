// ===== CONFIGURATION =====
const API_BASE_URL = "http://127.0.0.1:5000/api";

// ===== DOM ELEMENTS =====
const form = document.getElementById("shortenForm");
const urlInput = document.getElementById("urlInput");
const customCodeInput = document.getElementById("customCodeInput");
const expiresInInput = document.getElementById("expiresInInput");
const shortenBtn = document.getElementById("shortenBtn");
const urlError = document.getElementById("urlError");
const resultSection = document.getElementById("resultSection");
const originalUrlDisplay = document.getElementById("originalUrl");
const shortenedUrlInput = document.getElementById("shortenedUrl");
const copyBtn = document.getElementById("copyBtn");
const copyFeedback = document.getElementById("copyFeedback");
const openBtn = document.getElementById("openBtn");
const analyticsBtn = document.getElementById("analyticsBtn");
const analyticsSection = document.getElementById("analyticsSection");
const closeAnalyticsBtn = document.getElementById("closeAnalyticsBtn");
const historyContainer = document.getElementById("historyContainer");
const messageContainer = document.getElementById("messageContainer");

// ===== STATE MANAGEMENT =====
let currentShortCode = null;
let urlHistory = [];

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ URL Shortener App Loaded");
    loadHistory();
});

// ===== FORM SUBMISSION =====
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await shortenURL();
});

async function shortenURL() {
    const url = urlInput.value.trim();

    // Reset error state
    urlError.classList.add("hidden");
    urlError.textContent = "";

    // Validate URL
    if (!isValidURL(url)) {
        showError("Please enter a valid URL");
        return;
    }

    // Validate custom short code (optional)
    const customCode = customCodeInput ? customCodeInput.value.trim() : "";
    if (customCode) {
        if (customCode.length < 3 || customCode.length > 20) {
            showError("Custom short code must be between 3 and 20 characters");
            return;
        }

        if (!/^[A-Za-z0-9_-]+$/.test(customCode)) {
            showError("Custom short code can contain only letters, numbers, hyphens, and underscores");
            return;
        }
    }

    // Validate expiration (optional, minutes)
    const expiresRaw = expiresInInput ? expiresInInput.value.trim() : "";
    let expiresIn = null;
    if (expiresRaw) {
        expiresIn = parseInt(expiresRaw, 10);
        if (Number.isNaN(expiresIn) || expiresIn <= 0) {
            showError("Expiration must be a positive number of minutes");
            return;
        }
    }

    // Show loading state
    setShortenButtonLoading(true);

    try {
        const payload = { url };
        if (customCode) payload.custom_code = customCode;
        if (expiresIn) payload.expires_in = expiresIn;

        const response = await fetch(`${API_BASE_URL}/urls`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to shorten URL");
        }

        // Success
        currentShortCode = data.short_code;
        displayResult(url, data.short_code);
        await loadHistory();
        showMessage("✓ URL shortened successfully!", "success");
        urlInput.value = "";

    } catch (error) {
        console.error("❌ Error:", error);
        showError(error.message || "Failed to shorten URL. Please try again.");
    } finally {
        setShortenButtonLoading(false);
    }
}

// ===== URL VALIDATION =====
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// ===== DISPLAY RESULT =====
function displayResult(originalUrl, shortCode) {
    resultSection.classList.remove("hidden");
    originalUrlDisplay.textContent = originalUrl;
    shortenedUrlInput.value = `http://127.0.0.1:5000/${shortCode}`;
    
    // Scroll to result
    setTimeout(() => {
        resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
}

// ===== COPY BUTTON =====
copyBtn.addEventListener("click", () => {
    const shortUrl = shortenedUrlInput.value;
    
    navigator.clipboard.writeText(shortUrl).then(() => {
        copyFeedback.classList.remove("hidden");
        showMessage("✓ Copied to clipboard!", "success");
        
        setTimeout(() => {
            copyFeedback.classList.add("hidden");
        }, 2000);
    }).catch(() => {
        showError("Failed to copy to clipboard");
    });
});

// ===== OPEN SHORT URL =====
openBtn.addEventListener("click", () => {
    const shortUrl = shortenedUrlInput.value;
    window.open(shortUrl, "_blank");
});

// ===== ANALYTICS =====
analyticsBtn.addEventListener("click", () => {
    if (!currentShortCode) return;
    
    analyticsSection.classList.remove("hidden");
    fetchAndDisplayAnalytics(currentShortCode);
    
    setTimeout(() => {
        analyticsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
});

closeAnalyticsBtn.addEventListener("click", () => {
    analyticsSection.classList.add("hidden");
});

async function fetchAndDisplayAnalytics(shortCode) {
    try {
        const analyticsContainer = analyticsSection.querySelector('.analytics-grid') || analyticsSection;
        const prev = analyticsContainer.innerHTML;
        analyticsContainer.innerHTML = '<div class="loading">Loading analytics…</div>';

        const response = await fetch(`${API_BASE_URL}/urls/${shortCode}`);

        let data = {};
        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || "Failed to fetch analytics");
        }

        document.getElementById("totalClicks").textContent = data.click_count || 0;
        document.getElementById("createdDate").textContent = formatDate(data.created_at);
        document.getElementById("lastAccessed").textContent = data.last_accessed 
            ? formatDate(data.last_accessed) 
            : "Never";
        document.getElementById("expirationDate").textContent = data.expires_at 
            ? formatDate(data.expires_at) 
            : "No expiration";
        analyticsContainer.innerHTML = prev;

    } catch (error) {
        console.error("❌ Analytics Error:", error);
        showError("Failed to load analytics");
    }
}

// ===== HISTORY MANAGEMENT =====
async function loadHistory() {
    try {
        // show loading
        historyContainer.innerHTML = '<p class="loading">Loading history…</p>';

        const response = await fetch(`${API_BASE_URL}/urls`);

        let data = [];
        try {
            data = await response.json();
        } catch (e) {
            data = [];
        }

        if (!response.ok) {
            const errMsg = (data && data.error) ? data.error : 'Failed to load URL history';
            throw new Error(errMsg);
        }

        const sortedData = Array.isArray(data)
            ? [...data].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            : [];

        urlHistory = sortedData.map((item) => ({
            id: item.short_code || `${Date.now()}-${Math.random()}`,
            originalUrl: item.original_url,
            shortCode: item.short_code,
            clickCount: item.click_count || 0,
            createdAt: item.created_at || new Date().toISOString(),
            expiresAt: item.expires_at || null
        }));

        renderHistory();

    } catch (error) {
        console.error("❌ History load failed:", error);
        urlHistory = [];
        renderHistory();
        showError(error.message || "Failed to load URL history");
    }
}

function renderHistory() {
    if (urlHistory.length === 0) {
        historyContainer.innerHTML = '<p class="empty-state">📭 No URLs shortened yet. Create one to get started!</p>';
        return;
    }

    historyContainer.innerHTML = urlHistory.map(item => `
        <div class="history-item">
            <div class="history-item-row">
                <span class="history-item-label">📌 Original URL</span>
                <span class="history-item-value">${escapeHTML(item.originalUrl)}</span>
            </div>

            <div class="history-item-row">
                <span class="history-item-label">🔗 Short URL</span>
                <a href="http://127.0.0.1:5000/${item.shortCode}" 
                   target="_blank" 
                   class="history-item-short-url">
                    http://127.0.0.1:5000/${item.shortCode}
                </a>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                <div class="history-item-row">
                    <span class="history-item-label">👁️ Clicks</span>
                    <span class="history-item-value">${item.clickCount || 0}</span>
                </div>
                <div class="history-item-row">
                    <span class="history-item-label">📅 Created</span>
                    <span class="history-item-value">${formatDate(item.createdAt)}</span>
                </div>
                <div class="history-item-row">
                    <span class="history-item-label">⏳ Expires</span>
                    <span class="history-item-value">${item.expiresAt ? formatDate(item.expiresAt) : 'No expiration'}</span>
                </div>
            </div>

            <div class="history-item-actions">
                <button type="button" class="btn btn-secondary" 
                    onclick="copyHistoryUrl('${item.shortCode}')">
                    📋 Copy
                </button>
                <button type="button" class="btn btn-secondary" 
                    onclick="editHistoryItem('${item.shortCode}')">
                    ✏️ Edit
                </button>
                <button type="button" class="btn btn-secondary" 
                    onclick="openHistoryUrl('${item.shortCode}')">
                    🌐 Open
                </button>
                <button type="button" class="btn btn-secondary" 
                    onclick="viewHistoryAnalytics('${item.shortCode}')">
                    📊 Analytics
                </button>
                <button type="button" class="btn btn-secondary" 
                    onclick="deleteHistoryItem('${item.id}')" 
                    style="background: #dc2626;">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `).join("");
}

function copyHistoryUrl(shortCode) {
    const url = `http://127.0.0.1:5000/${shortCode}`;
    navigator.clipboard.writeText(url).then(() => {
        showMessage("✓ Copied to clipboard!", "success");
    }).catch(() => {
        showError("Failed to copy to clipboard");
    });
}

function openHistoryUrl(shortCode) {
    window.open(`http://127.0.0.1:5000/${shortCode}`, "_blank");
}

function viewHistoryAnalytics(shortCode) {
    currentShortCode = shortCode;
    analyticsSection.classList.remove("hidden");
    fetchAndDisplayAnalytics(shortCode);
    setTimeout(() => {
        analyticsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
}

async function editHistoryItem(shortCode) {
    const item = urlHistory.find(i => i.shortCode === shortCode);
    if (!item) {
        showError("URL not found");
        return;
    }

    const newUrl = prompt("Edit original URL:", item.originalUrl);
    if (!newUrl || newUrl.trim() === "") return;

    if (!isValidURL(newUrl.trim())) {
        showError("Please enter a valid URL");
        return;
    }

    const btn = document.querySelector(`button[onclick="editHistoryItem('${shortCode}')"]`);
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/urls/${shortCode}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: newUrl.trim() })
        });

        let data = {};
        try { data = await response.json(); } catch(e) { data = {}; }

        if (!response.ok) {
            throw new Error(data.error || "Failed to update URL");
        }

        await loadHistory();
        showMessage("✓ URL updated successfully!", "success");
    } catch (error) {
        console.error("❌ Update Error:", error);
        showError(error.message || "Failed to update URL");
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function deleteHistoryItem(id) {
    const item = urlHistory.find(item => item.id === id);

    if (!item) {
        showError("URL not found");
        return;
    }

    if (!confirm("Are you sure you want to delete this URL?")) {
        return;
    }

    const btn = document.querySelector(`button[onclick="deleteHistoryItem('${id}')"]`);
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/urls/${item.shortCode}`, {
            method: "DELETE"
        });

        let data = {};
        try { data = await response.json(); } catch(e) { data = {}; }

        if (!response.ok) {
            throw new Error(data.error || "Failed to delete URL");
        }

        await loadHistory();

        showMessage("✓ URL deleted successfully!", "success");

    } catch (error) {
        console.error("❌ Delete Error:", error);
        showError(error.message || "Failed to delete URL");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ===== UI HELPERS =====
function setShortenButtonLoading(isLoading) {
    shortenBtn.disabled = isLoading;
    
    if (isLoading) {
        document.querySelector(".btn-text").classList.add("hidden");
        document.querySelector(".btn-loader").classList.remove("hidden");
    } else {
        document.querySelector(".btn-text").classList.remove("hidden");
        document.querySelector(".btn-loader").classList.add("hidden");
    }
}

function showError(message) {
    urlError.textContent = message;
    urlError.classList.remove("hidden");
    showMessage(`❌ ${message}`, "error");
}

function showMessage(message, type = "info") {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageContainer.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return "—";
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (e) {
        return "—";
    }
}

function escapeHTML(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener("keydown", (event) => {
    // Copy on Ctrl+C when shortened URL is visible
    if (event.ctrlKey && event.key === "c" && !resultSection.classList.contains("hidden")) {
        const selection = window.getSelection().toString();
        if (!selection) {
            copyBtn.click();
        }
    }
});

console.log("🚀 All event listeners attached");