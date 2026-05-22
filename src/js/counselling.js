/* global lucide */

import { DatasetParser } from './datasetParser.js';
import { TrendAnalyzer } from './trendAnalyzer.js';
import { RecommendationEngine } from './recommendationEngine.js';
import { Dashboard } from './dashboard.js';

// Dynamic datasets loaded at runtime from counselling_data.json
let collegesDatasetMap = {};
let branchesDataset = [];
let collegesDataset = [];

// Help line center list representation (loaded dynamically from hlc_data.json)
let hlcDataset = [];
let activeHlcDistrictFilter = "ALL";

// Core variables
let generatedPreferences = [];
let mockOptionsList = [];

// Privacy masking helpers for public demos/screenshots
function maskName(name = "Student Demo") {
    const clean = String(name).trim();
    if (!clean) return "Student Demo";
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return `${parts[0].charAt(0).toUpperCase()}.`;
    return `${parts[0].charAt(0).toUpperCase()}. ${parts[parts.length - 1]}`;
}

function maskPhone(phone = "") {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length < 4) return "98XXXXXX63";
    return `${digits.slice(0, 2)}XXXXXX${digits.slice(-2)}`;
}

function maskAadhaar(aadhaar = "") {
    const digits = String(aadhaar).replace(/\D/g, "");
    const tail = digits.length >= 4 ? digits.slice(-4) : "4582";
    return `XXXX XXXX ${tail}`;
}

function maskEmail(email = "") {
    const safe = String(email).trim().toLowerCase();
    const parts = safe.split("@");
    if (parts.length !== 2) return "ab***@gmail.com";
    const user = parts[0];
    const domain = parts[1] || "gmail.com";
    const head = user.slice(0, 2) || "ab";
    return `${head}***@${domain}`;
}

function maskHallTicket(ticket = "") {
    const val = String(ticket).replace(/\s/g, "");
    if (val.length < 6) return "2505XXXX92";
    return `${val.slice(0, 4)}XXXX${val.slice(-2)}`;
}

function maskRegistrationNo(reg = "") {
    const val = String(reg).replace(/\s/g, "");
    if (val.length < 6) return "22XXXX04";
    return `${val.slice(0, 2)}XXXX${val.slice(-2)}`;
}

function maskCertificateId(prefix = "DOC", id = "") {
    const digits = String(id).replace(/\D/g, "");
    const tail = digits.length >= 3 ? digits.slice(-3) : "782";
    return `${prefix}XXXX${tail}`;
}

function maskTransactionId(txn = "") {
    const digits = String(txn).replace(/\D/g, "");
    const tail = digits.length >= 4 ? digits.slice(-4) : "4587";
    return `TXNXXXX${tail}`;
}

function maskAdmissionNo(adm = "") {
    const digits = String(adm).replace(/\D/g, "");
    const tail = digits.length >= 4 ? digits.slice(-4) : "0291";
    return `ADMXXXX${tail}`;
}

function maskLoginId(loginId = "") {
    const raw = String(loginId).replace(/\s/g, "");
    if (raw.length < 6) return "TGE2XXXX43";
    return `${raw.slice(0, 4)}XXXX${raw.slice(-2)}`;
}

function applyPrivacyMaskingToDom() {
    const fieldMaskers = [
        { selector: '#spa-fee-ticket, #spa-verify-ticket, #sim-slot-login-ticket, #sim-pwd-ticket, #sim-portal-ticket, #sim-summary-ticket', fn: maskHallTicket },
        { selector: '#spa-fee-reg, #spa-verify-reg, #sim-slot-login-reg, #sim-pwd-reg', fn: maskRegistrationNo },
        { selector: '#sim-pwd-phone', fn: maskPhone },
        { selector: '#sim-pwd-email', fn: maskEmail },
    ];

    fieldMaskers.forEach(({ selector, fn }) => {
        document.querySelectorAll(selector).forEach(el => {
            if (el && 'value' in el) {
                el.value = fn(el.value || "");
            }
        });
    });

    // Broad pass for transaction, hall-ticket, registration, aadhaar-like text in static nodes.
    const textNodes = document.querySelectorAll('span,strong,td,p,div');
    textNodes.forEach(node => {
        const text = node.textContent || "";
        if (!text) return;
        let updated = text
            .replace(/TXN\d{6,}/g, (m) => maskTransactionId(m))
            .replace(/\bADM[-\w]*\d{2,}\b/g, (m) => maskAdmissionNo(m))
            .replace(/\b\d{12}\b/g, (m) => maskAadhaar(m))
            .replace(/\b\d{10}\b/g, (m) => maskPhone(m))
            .replace(/\b\d{8,}\b/g, (m) => {
                if (text.toLowerCase().includes('hall ticket')) return maskHallTicket(m);
                if (text.toLowerCase().includes('registration')) return maskRegistrationNo(m);
                return m;
            });
        if (updated !== text) node.textContent = updated;
    });
}

// Load dynamic counselling data
async function loadCounsellingData() {
    try {
        const response = await fetch('./counselling_data.json');
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        
        collegesDatasetMap = data.colleges;
        branchesDataset = data.branches;
        collegesDataset = Object.values(data.colleges);

        // Load dynamic Helpline Centres verified data
        try {
            const hlcResponse = await fetch('./hlc_data.json');
            if (hlcResponse.ok) {
                hlcDataset = await hlcResponse.json();
                populateHlcDistrictChips();
                renderTelanganaMap();
                populateHlcs();
            }
        } catch (hlcErr) {
            console.error("Error loading HLC dataset:", hlcErr);
        }

        // Initialize dynamic elements
        populateGeneratorBranches();
        populateGeneratorDistricts();
        populateMockColleges();
        initBranchExplorer();

        // Generate standard placeholder preference list automatically
        generatePreferenceList();
    } catch (err) {
        console.error("Error loading TG EAPCET counselling data:", err);
        showToast("Data Error", "Failed to load dynamic counselling data. Using fallbacks.", "alert-circle");
    }
}

// Initialize Lucide Icons on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    applyPrivacyMaskingToDom();
    populateHlcs();
    loadCounsellingData();
    initPlatformUpdatePopup();

    // Bind real-time regeneration event listeners
    const rankEl = document.getElementById('student-rank');
    if (rankEl) {
        rankEl.addEventListener('input', () => {
            if (window.debounceTimer) clearTimeout(window.debounceTimer);
            window.debounceTimer = setTimeout(() => {
                generatePreferenceList();
            }, 300);
        });
    }
    const catEl = document.getElementById('student-category');
    if (catEl) {
        catEl.addEventListener('change', generatePreferenceList);
    }
    const phaseEl = document.getElementById('counselling-phase');
    if (phaseEl) {
        phaseEl.addEventListener('change', generatePreferenceList);
    }
    document.querySelectorAll('input[name="student-gender"]').forEach(el => {
        el.addEventListener('change', generatePreferenceList);
    });
});

const PLATFORM_UPDATE_POPUP_KEY = 'eapcet_platform_update_seen_v2';

function initPlatformUpdatePopup() {
    try {
        const seen = localStorage.getItem(PLATFORM_UPDATE_POPUP_KEY);
        if (seen === '1') return;
    } catch (err) {
        // ignore storage access errors and continue to show once for this session
    }

    setTimeout(() => {
        const popup = document.getElementById('platform-update-popup');
        const card = document.getElementById('platform-update-popup-card');
        if (!popup || !card) return;

        popup.classList.remove('hidden');
        popup.classList.add('flex');

        requestAnimationFrame(() => {
            card.classList.remove('scale-95', 'opacity-0');
            card.classList.add('scale-100', 'opacity-100');
        });
    }, 900);
}

function closePlatformUpdatePopup() {
    const popup = document.getElementById('platform-update-popup');
    const card = document.getElementById('platform-update-popup-card');
    if (!popup || !card) return;

    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        popup.classList.add('hidden');
        popup.classList.remove('flex');
    }, 220);

    try {
        localStorage.setItem(PLATFORM_UPDATE_POPUP_KEY, '1');
    } catch (err) {
        // best effort only
    }
}

function handlePopupExploreUpdates() {
    closePlatformUpdatePopup();
    showView('guide');
    showGuideScreen(1);
    showToast("Updates Ready", "Explore the upgraded recommendation and counselling guide modules.", "sparkles");
}

// Interactive Page View Swapping Logic
function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.add('hidden');
    });
    const target = document.getElementById(viewId + '-view') || document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (viewId === 'guide' || viewId === 'guide-view') {
        if (typeof showGuideScreen === 'function') {
            showGuideScreen(1);
        }
    }
    // Trigger Lucide re-population to bind elements inside views
    lucide.createIcons();
}

function scrollToCoreModules() {
    showView('home');
    const el = document.getElementById('core-modules');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const icon = document.getElementById('menu-icon');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        icon.setAttribute('data-lucide', 'x');
    } else {
        menu.classList.add('hidden');
        icon.setAttribute('data-lucide', 'menu');
    }
    lucide.createIcons();
}

// Exact cutoff rank calculation from processed dataset
function getExactCutoff(cutoffsObj, category, gender) {
    if (!cutoffsObj) return null;
    
    const genderKey = gender === 'GIRLS' ? 'GIRLS' : 'BOYS';
    
    if (category === 'SC') {
        const ranks = [];
        for (const scSub of ['SC_I', 'SC_II', 'SC_III']) {
            const key = `${scSub}_${genderKey}`;
            if (cutoffsObj[key]) ranks.push(cutoffsObj[key]);
        }
        if (ranks.length > 0) return Math.max(...ranks);
    } else {
        const key = `${category}_${genderKey}`;
        if (cutoffsObj[key]) return cutoffsObj[key];
    }
    
    // Fallbacks
    const ocKey = `OC_${genderKey}`;
    if (cutoffsObj[ocKey]) return cutoffsObj[ocKey];
    if (cutoffsObj['OC_BOYS']) return cutoffsObj['OC_BOYS'];
    
    return null;
}

function getCutoffForPhase(branchObj, phase, category, gender) {
    if (!branchObj || !branchObj.cutoffs) return null;
    if (phase === 'Combined') {
        const phases = ['phase1', 'phase2', 'finalPhase'];
        const ranks = [];
        for (const p of phases) {
            const val = getExactCutoff(branchObj.cutoffs[p], category, gender);
            if (val) ranks.push(val);
        }
        return ranks.length > 0 ? Math.max(...ranks) : null;
    } else {
        const pKey = phase === 'Phase 1' ? 'phase1' : (phase === 'Phase 2' ? 'phase2' : 'finalPhase');
        return getExactCutoff(branchObj.cutoffs[pKey], category, gender);
    }
}

// Generation Algorithm
function generatePreferenceList() {
    const rank = parseInt(document.getElementById('student-rank').value) || 10000;
    const category = document.getElementById('student-category').value || "OC";
    const gender = document.querySelector('input[name="student-gender"]:checked').value;
    const phase = document.getElementById('counselling-phase').value || "Phase 1";

    // Get selected branch values
    const branchSelector = document.querySelectorAll('#branch-chips input:checked');
    const chosenBranches = Array.from(branchSelector).map(chip => chip.value);

    // Get selected districts
    const districtSelector = document.querySelectorAll('#district-checks input:checked');
    const chosenDistricts = Array.from(districtSelector).map(d => d.value);

    const results = RecommendationEngine.generateList(
        collegesDataset, 
        rank, 
        category, 
        gender, 
        phase, 
        chosenBranches, 
        chosenDistricts
    );

    generatedPreferences = results; 

    renderPreferences();
    
    showToast("Success", "Custom Preference options generated!", "check");
}

// Render Generated Order List
function renderPreferences() {
    Dashboard.renderPreferencesList(generatedPreferences);
}

function toggleInsight(index) {
    Dashboard.toggleInsight(index);
}

// Move item index manually via arrows
function moveItem(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= generatedPreferences.length) return;

    // Swap positions
    const temp = generatedPreferences[index];
    generatedPreferences[index] = generatedPreferences[targetIndex];
    generatedPreferences[targetIndex] = temp;

    renderPreferences();
}

// Remove single college item from active dashboard
function removeItem(index) {
    const removed = generatedPreferences[index];
    generatedPreferences.splice(index, 1);
    renderPreferences();
    showToast("Item Removed", `${removed.code} (${removed.branch}) removed from list.`, "trash");
}

// Stats Calculation
function updateSummaryStats() {
    // Stats boxes removed in UI refresh
}

// HTML5 Drag and Drop Handlers
function handleDragStart(e) {
    this.classList.add('opacity-40');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-index'));
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const targetIndex = parseInt(this.getAttribute('data-index'));

    if (sourceIndex !== targetIndex) {
        const movedItem = generatedPreferences[sourceIndex];
        generatedPreferences.splice(sourceIndex, 1);
        generatedPreferences.splice(targetIndex, 0, movedItem);
        renderPreferences();
    }
    return false;
}

function handleDragEnd() {
    this.classList.remove('opacity-40');
    document.querySelectorAll('#preferences-container > div').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// PDF Print Modal Setup
function openPdfPreviewModal() {
    if (generatedPreferences.length === 0) {
        showToast("Error", "Please generate a preference list first.", "alert-circle");
        return;
    }

    const name = "Student";
    const rank = document.getElementById('student-rank').value || "6917";
    const category = document.getElementById('student-category').value || "EWS";

    document.getElementById('pdf-student').innerText = name;
    document.getElementById('pdf-rank').innerText = rank.toLocaleString();
    document.getElementById('pdf-category').innerText = category;

    // Populate PDF Table Rows
    const tableBody = document.getElementById('pdf-table-body');
    tableBody.innerHTML = "";

    generatedPreferences.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = "border-b border-slate-100 hover:bg-slate-50";
        row.innerHTML = `
            <td class="py-2.5 px-3 text-center font-bold text-slate-800">${index + 1}</td>
            <td class="py-2.5 px-3 font-bold text-purple-700">${item.code}</td>
            <td class="py-2.5 px-3 text-slate-700">${item.name}</td>
            <td class="py-2.5 px-3"><span class="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-semibold">${item.branch}</span></td>
            <td class="py-2.5 px-3 text-slate-600">${item.district}</td>
            <td class="py-2.5 px-3 font-semibold text-right">${item.trend.toLocaleString()}</td>
            <td class="py-2.5 px-3 text-center"><span class="text-slate-500">${item.matchedPhase}</span></td>
        `;
        tableBody.appendChild(row);
    });

    document.getElementById('pdf-modal').classList.remove('hidden');
}

function closePdfPreviewModal() {
    document.getElementById('pdf-modal').classList.add('hidden');
}

function triggerPrintDoc() {
    window.print();
}

// Export Excel CSV Sheet
function exportToExcel() {
    if (generatedPreferences.length === 0) {
        showToast("Error", "Please generate a preference list first.", "alert-circle");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";

    // Header Info
    csvContent += "TG EAPCET Counselling Companion - Generated Preference Report\n";
    csvContent += `Student Name,Student\n`;
    csvContent += `EAPCET Rank,${document.getElementById('student-rank').value || '6917'}\n`;
    csvContent += `Category,${document.getElementById('student-category').value || 'EWS'}\n\n`;

    // Table Header Column
    csvContent += "Order,College Code,College Name,Branch,District,Previous Last Rank,Matched Phase\n";

    // List Items
    generatedPreferences.forEach((item, index) => {
        const escapedName = item.name.replace(/"/g, '""'); // Escape double quotes for CSV
        csvContent += `${index + 1},${item.code},"${escapedName}",${item.branch},${item.district},${item.trend},"${item.matchedPhase}"\n`;
    });

    // Disclaimer Row
    csvContent += "\nDisclaimer: This report is generated for counselling guidance purposes only using previous counselling trends.";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EAPCET_Preference_List_${document.getElementById('student-rank').value || 'Report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Excel Exported", "Editable CSV sheet downloaded successfully!", "sheet");
}

// Save Current active choices
function saveCurrentList() {
    showToast("Saved", "Preference Order saved in temporary storage!", "save");
}

// Simple Custom Toast Alert Box logic
function showToast(title, text, iconName = "check") {
    const toast = document.getElementById('toast');
    const message = document.getElementById('toast-message');
    const iconBox = document.getElementById('toast-icon-box');

    if (!toast || !message || !iconBox) return;

    message.innerHTML = `<strong>${title}:</strong> ${text}`;

    // Set icon
    iconBox.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
    lucide.createIcons();

    // Slide in animation
    toast.classList.remove('opacity-0', 'translate-y-12', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-12', 'pointer-events-none');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3500);
}

// ================= TELANGANA SVG INTERACTIVE MAP DATA & RENDER =================
function getDistrictSizeClass(name) {
    const smallDists = [
        "Hyderabad", "Medchal", "Warangal(urban)", "Jangaon", "Rajanna", 
        "Wanaparthy", "Mahabubabad", "Sangareddy", "Karimnagar", "Peddapalli", 
        "Yadadri", "Siddipet", "Medak", "Kamareddy", "Nirmal", "Jagtial", 
        "Mancherial", "Vikarabad"
    ];
    if (smallDists.includes(name)) return "label-size-small";
    return "label-size-large";
}

function createWrappedSvgLabel(textNode, name, x, y) {
    textNode.innerHTML = ""; // Clear
    textNode.setAttribute("x", x);
    textNode.setAttribute("y", y + 15);
    
    let displayName = name;
    if (name === "Warangal(urban)") displayName = "Hanamkonda";
    else if (name === "Warangal(rural)") displayName = "Warangal";
    else if (name === "Komaram Bheem") displayName = "Asifabad";
    else if (name === "Ranga Reddy") displayName = "Rangareddy";
    else if (name === "Rajanna") displayName = "Sircilla";
    else if (name === "Jayashankar") displayName = "Bhupalpally";
    else if (name === "Nagarkurnool") displayName = "Nagarkurnool";
    else if (name === "Mahbubnagar") displayName = "Mahbubnagar";
    else if (name === "Sangareddy") displayName = "Sangareddy";
    else if (name === "Medchal") displayName = "Medchal";
    else if (name === "Yadadri") displayName = "Yadadri";
    else if (name === "Bhadradri") displayName = "Bhadradri";
    else if (name === "Wanaparthy") displayName = "Wanaparthy";
    else if (name === "Peddapalli") displayName = "Peddapalli";
    else if (name === "Mancherial") displayName = "Mancherial";
    else if (name === "Karimnagar") displayName = "Karimnagar";
    else if (name === "Mahabubabad") displayName = "Mahabubabad";
    else if (name === "Suryapet") displayName = "Suryapet";
    else if (name === "Kamareddy") displayName = "Kamareddy";
    else if (name === "Nizamabad") displayName = "Nizamabad";
    else if (name === "Vikarabad") displayName = "Vikarabad";

    textNode.textContent = displayName;
    
    // Append size class dynamically
    textNode.classList.add(getDistrictSizeClass(name));
}

const DISTRICT_MAPPING = {
    "ADILABAD": "Adilabad",
    "MANCHERIAL": "Mancherial",
    "NIRMAL": "Nirmal",
    "HYDERABAD": "Hyderabad",
    "MEDCHAL": "Medchal",
    "PEDDAPALLI": "Peddapalli",
    "JAGTIAL": "Jagtial",
    "KARIMNAGAR": "Karimnagar",
    "RAJANNA SIRCILLA": "Rajanna",
    "KHAMMAM": "Khammam",
    "BHADRADRI KOTHAGUDEM": "Bhadradri",
    "MAHABUBNAGAR": "Mahbubnagar",
    "NAGARKURNOOL": "Nagarkurnool",
    "JOGULAMBA GADWAL": "Gadwal",
    "WANAPARTHY": "Wanaparthy",
    "MEDAK": "Medak",
    "SANGA REDDY": "Sangareddy",
    "SANGAREDDY": "Sangareddy",
    "SIDDIPET": "Siddipet",
    "NALGONDA": "Nalgonda",
    "SURYAPET": "Suryapet",
    "YADADIRI BHUVANAGIRI": "Yadadri",
    "KAMAREDDY": "Kamareddy",
    "NIZAMABAD": "Nizamabad",
    "VIKARABAD": "Vikarabad",
    "JAYASHANKAR BHOOPALPALLI": "Jayashankar",
    "JANGAON": "Jangaon",
    "MAHABUBABAD": "Mahabubabad",
    "WARANGAL URBAN": "Warangal(urban)",
    "HANAMKONDA": "Warangal(urban)",
    "WARANGAL": "Warangal(rural)"
};

const DISTRICT_CENTROIDS = {
    "Adilabad": { "x": 310, "y": 95 },
    "Komaram Bheem": { "x": 480, "y": 125 },
    "Nirmal": { "x": 280, "y": 180 },
    "Mancherial": { "x": 515, "y": 220 },
    "Nizamabad": { "x": 240, "y": 260 },
    "Jagtial": { "x": 375, "y": 235 },
    "Peddapalli": { "x": 480, "y": 290 },
    "Kamareddy": { "x": 210, "y": 345 },
    "Rajanna": { "x": 350, "y": 365 },
    "Karimnagar": { "x": 425, "y": 345 },
    "Jayashankar": { "x": 660, "y": 320 },
    "Medak": { "x": 235, "y": 420 },
    "Sangareddy": { "x": 215, "y": 470 },
    "Siddipet": { "x": 315, "y": 435 },
    "Jangaon": { "x": 445, "y": 465 },
    "Warangal(urban)": { "x": 520, "y": 412 },
    "Warangal(rural)": { "x": 585, "y": 440 },
    "Mahabubabad": { "x": 635, "y": 495 },
    "Bhadradri": { "x": 780, "y": 530 },
    "Vikarabad": { "x": 130, "y": 565 },
    "Medchal": { "x": 325, "y": 505 },
    "Yadadri": { "x": 405, "y": 555 },
    "Hyderabad": { "x": 285, "y": 542 },
    "Ranga Reddy": { "x": 260, "y": 610 },
    "Nalgonda": { "x": 450, "y": 660 },
    "Suryapet": { "x": 575, "y": 615 },
    "Khammam": { "x": 710, "y": 625 },
    "Mahbubnagar": { "x": 150, "y": 685 },
    "Nagarkurnool": { "x": 335, "y": 735 },
    "Wanaparthy": { "x": 195, "y": 765 },
    "Gadwal": { "x": 145, "y": 815 }
};

function renderTelanganaMap() {
    const svg = document.getElementById('telangana-svg-map');
    if (!svg) return;

    svg.innerHTML = `
        <text x="465" y="440" text-anchor="middle" class="fill-slate-400 font-semibold animate-pulse text-sm">
            Loading Interactive GIS Map...
        </text>
    `;

    fetch('/telangana_districts.svg')
        .then(response => {
            if (!response.ok) throw new Error('SVG not found');
            return response.text();
        })
        .then(svgText => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const paths = xmlDoc.querySelectorAll('path.tel');
            
            svg.innerHTML = `
                <defs>
                    <linearGradient id="grad-density-low" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#f8fafc" />
                        <stop offset="100%" stop-color="#f1f5f9" />
                    </linearGradient>
                    <linearGradient id="grad-density-med" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#f5f3ff" />
                        <stop offset="100%" stop-color="#e9d5ff" />
                    </linearGradient>
                    <linearGradient id="grad-density-high" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ddd6fe" />
                        <stop offset="100%" stop-color="#c084fc" />
                    </linearGradient>
                    <linearGradient id="grad-density-selected" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#c084fc" />
                        <stop offset="100%" stop-color="#818cf8" />
                    </linearGradient>
                    
                    <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
            `;

            // Calculate HLC count per district dynamically
            const hlcCounts = {};
            hlcDataset.forEach(hlc => {
                const dist = hlc.district;
                if (dist) {
                    const upperDist = dist.toUpperCase();
                    hlcCounts[upperDist] = (hlcCounts[upperDist] || 0) + 1;
                }
            });

            const activeDistrictsInDataset = new Set(hlcDataset.map(h => h.district.toUpperCase()));

            // 1. Render all district paths
            paths.forEach(path => {
                const svgName = path.getAttribute('name');
                const d = path.getAttribute('d');
                
                const dbName = Object.keys(DISTRICT_MAPPING).find(key => DISTRICT_MAPPING[key] === svgName);
                const hasColleges = dbName && activeDistrictsInDataset.has(dbName);
                const isSelected = activeHlcDistrictFilter !== "ALL" && dbName === activeHlcDistrictFilter.toUpperCase();
                const count = dbName ? (hlcCounts[dbName.toUpperCase()] || 0) : 0;
                
                const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pathEl.setAttribute("d", d);
                
                const pathIdSafe = svgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                pathEl.setAttribute("id", `map-path-${pathIdSafe}`);
                
                let baseClasses = "map-district-path ";
                
                if (isSelected) {
                    baseClasses += "map-district-selected ";
                } else if (count > 2) {
                    baseClasses += "map-density-high ";
                } else if (count > 0) {
                    baseClasses += "map-density-medium ";
                } else {
                    baseClasses += "map-density-none ";
                }
                
                pathEl.setAttribute("class", baseClasses);
                
                pathEl.onmouseenter = () => {
                    const dotG = document.getElementById(`map-dot-${pathIdSafe}`);
                    if (dotG) dotG.classList.add('hovered');
                };
                pathEl.onmouseleave = () => {
                    const dotG = document.getElementById(`map-dot-${pathIdSafe}`);
                    if (dotG) dotG.classList.remove('hovered');
                };
                
                if (hasColleges && dbName) {
                    pathEl.onclick = () => {
                        filterHlcByDistrict(dbName);
                        showToast("Region Filtered", `Showing verification centres in ${dbName} district.`, "map-pin");
                    };
                }
                
                svg.appendChild(pathEl);
            });

            // 2. Render bold outer state outline
            const outerPath = xmlDoc.getElementById('path3725');
            if (outerPath) {
                const outerBorderEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                outerBorderEl.setAttribute("d", outerPath.getAttribute('d'));
                outerBorderEl.setAttribute("class", "map-outer-border");
                svg.appendChild(outerBorderEl);
            }

            // 3. Render district labels and glowing dots
            Object.keys(DISTRICT_CENTROIDS).forEach(districtName => {
                const centroid = DISTRICT_CENTROIDS[districtName];
                const dbName = Object.keys(DISTRICT_MAPPING).find(key => DISTRICT_MAPPING[key] === districtName);
                const hasColleges = dbName && activeDistrictsInDataset.has(dbName);
                const isSelected = activeHlcDistrictFilter !== "ALL" && dbName === activeHlcDistrictFilter.toUpperCase();
                
                if (hasColleges && dbName) {
                    const dotG = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    const dotIdSafe = districtName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    dotG.setAttribute("class", `district-dot-group cursor-pointer transition-all duration-300 ${isSelected ? 'selected' : ''}`);
                    dotG.setAttribute("id", `map-dot-${dotIdSafe}`);
                    
                    dotG.onclick = () => {
                        filterHlcByDistrict(dbName);
                        showToast("Region Filtered", `Showing verification centres in ${dbName} district.`, "map-pin");
                    };
                    
                    dotG.onmouseenter = () => {
                        const targetPath = document.getElementById(`map-path-${dotIdSafe}`);
                        if (targetPath) targetPath.classList.add('hovered-path');
                    };
                    dotG.onmouseleave = () => {
                        const targetPath = document.getElementById(`map-path-${dotIdSafe}`);
                        if (targetPath) targetPath.classList.remove('hovered-path');
                    };
                    
                    // Glowing outer pulse
                    const pulseCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    pulseCircle.setAttribute("cx", centroid.x);
                    pulseCircle.setAttribute("cy", centroid.y);
                    pulseCircle.setAttribute("r", isSelected ? 15 : 10);
                    pulseCircle.setAttribute("class", `fill-purple-500/30 transition-all duration-300 ${isSelected ? 'animate-ping' : 'animate-pulse'}`);
                    dotG.appendChild(pulseCircle);
                    
                    // Solid inner dot
                    const solidCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    solidCircle.setAttribute("cx", centroid.x);
                    solidCircle.setAttribute("cy", centroid.y);
                    solidCircle.setAttribute("r", isSelected ? 5 : 4);
                    solidCircle.setAttribute("class", "fill-purple-600 stroke-white stroke-2 shadow-sm");
                    dotG.appendChild(solidCircle);
                    
                    // Text label below dot
                    const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    textLabel.setAttribute("text-anchor", "middle");
                    
                    let labelClasses = "map-district-label ";
                    if (isSelected) {
                        labelClasses += "map-district-label-selected";
                    }
                    textLabel.setAttribute("class", labelClasses);
                    createWrappedSvgLabel(textLabel, districtName, centroid.x, centroid.y);
                    dotG.appendChild(textLabel);
                    
                    svg.appendChild(dotG);
                }
            });
        })
        .catch(err => {
            console.error('Error loading Telangana map:', err);
            renderFallbackTelanganaMap();
        });
}

function renderFallbackTelanganaMap() {
    const svg = document.getElementById('telangana-svg-map');
    if (!svg) return;
    svg.innerHTML = `
        <rect x="20" y="20" width="890" height="840" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
        <text x="465" y="420" text-anchor="middle" class="fill-red-500 font-bold text-sm">
            Could not load Telangana map asset.
        </text>
        <text x="465" y="450" text-anchor="middle" class="fill-slate-500 text-xs font-medium">
            Please check that telangana_districts.svg is correctly present in the public/ folder.
        </text>
    `;
}

// ================= HELPLINE CENTRES DIRECTORY FILTER =================
function populateHlcDistrictChips() {
    const container = document.getElementById('hlc-district-chips');
    if (!container) return;
    container.innerHTML = "";

    // Extract unique districts from hlcDataset
    const districts = [...new Set(hlcDataset.map(h => h.district))].sort();

    // Add "ALL" chip first
    const allBtn = document.createElement('button');
    allBtn.id = "chip-hlc-all";
    allBtn.className = `hlc-chip px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        activeHlcDistrictFilter === "ALL" 
            ? "bg-purple-600 text-white shadow-md" 
            : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
    }`;
    allBtn.innerText = "All Districts";
    allBtn.onclick = () => filterHlcByDistrict("ALL");
    container.appendChild(allBtn);

    districts.forEach(dist => {
        const btn = document.createElement('button');
        const chipId = `chip-hlc-${dist.replace(/[^a-zA-Z0-9]/g, '-')}`;
        btn.id = chipId;
        btn.className = `hlc-chip px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeHlcDistrictFilter === dist 
                ? "bg-purple-600 text-white shadow-md" 
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
        }`;
        btn.innerText = dist;
        btn.onclick = () => filterHlcByDistrict(dist);
        container.appendChild(btn);
    });
}

function filterHlcByDistrict(dist) {
    activeHlcDistrictFilter = dist;
    // Toggle active state styling on district chips
    document.querySelectorAll('.hlc-chip').forEach(btn => {
        btn.className = "hlc-chip px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all";
    });
    
    const chipId = dist === "ALL" 
        ? "chip-hlc-all"
        : `chip-hlc-${dist.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const activeChip = document.getElementById(chipId);
    if (activeChip) {
        activeChip.className = "hlc-chip px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-md transition-all scale-[1.03]";
    }

    // Reset styles on all SVG path elements and district dots
    document.querySelectorAll('.map-district-path').forEach(el => {
        el.classList.remove('map-district-active');
    });
    document.querySelectorAll('.district-dot-group').forEach(el => {
        el.classList.remove('selected');
        const circles = el.querySelectorAll('circle');
        if (circles[0]) {
            circles[0].setAttribute("r", "10");
            circles[0].setAttribute("class", "fill-purple-500/30 transition-all duration-300 animate-pulse");
        }
        if (circles[1]) {
            circles[1].setAttribute("r", "4");
        }
        const text = el.querySelector('text');
        if (text) {
            text.setAttribute("class", "text-[9px] font-extrabold tracking-wide pointer-events-none select-none uppercase transition-all duration-300 fill-slate-600 font-semibold");
        }
    });
    
    if (dist !== "ALL") {
        const key = Object.keys(DISTRICT_MAPPING).find(k => 
            dist.toUpperCase().includes(k) || k.includes(dist.toUpperCase())
        );
        if (key) {
            const svgName = DISTRICT_MAPPING[key];
            const idSafe = svgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            
            const pathEl = document.getElementById(`map-path-${idSafe}`);
            if (pathEl) {
                pathEl.classList.add('map-district-active');
            }
            
            const dotEl = document.getElementById(`map-dot-${idSafe}`);
            if (dotEl) {
                dotEl.classList.add('selected');
                const circles = dotEl.querySelectorAll('circle');
                if (circles[0]) {
                    circles[0].setAttribute("r", "15");
                    circles[0].setAttribute("class", "fill-purple-500/30 transition-all duration-300 animate-ping");
                }
                if (circles[1]) {
                    circles[1].setAttribute("r", "5");
                }
                const text = dotEl.querySelector('text');
                if (text) {
                    text.setAttribute("class", "text-[9px] font-extrabold tracking-wide pointer-events-none select-none uppercase transition-all duration-300 fill-purple-800 scale-[1.08] font-black");
                }
            }
        }
    }

    populateHlcs();
}

function filterByMapRegion(regionName) {
    filterHlcByDistrict(regionName);
    showToast("Region Filtered", `Showing verification centres in ${regionName} district.`, "map-pin");
}

function populateHlcs() {
    const list = document.getElementById('hlc-list');
    if (!list) return;
    list.innerHTML = "";

    const searchInput = document.getElementById('hlc-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let filtered = hlcDataset;

    // 1. Filter by District Selection
    if (activeHlcDistrictFilter !== "ALL") {
        const selectedDist = activeHlcDistrictFilter.toUpperCase();
        filtered = filtered.filter(hlc => {
            return hlc.district.toUpperCase().includes(selectedDist) || selectedDist.includes(hlc.district.toUpperCase());
        });
    }

    // 2. Filter by Search Query
    if (query) {
        filtered = filtered.filter(hlc => {
            return hlc.name.toLowerCase().includes(query) ||
                   hlc.place.toLowerCase().includes(query) ||
                   hlc.district.toLowerCase().includes(query) ||
                   hlc.code.toLowerCase().includes(query);
        });
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="text-center py-10 text-slate-400 text-xs">
                <i data-lucide="info" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
                No verified helpline centres match your selection.
            </div>`;
        lucide.createIcons();
        return;
    }

    filtered.forEach((hlc, index) => {
        const card = document.createElement('div');
        card.className = "hlc-card-interactive p-6 bg-white/85 border border-slate-200/50 rounded-2xl shadow-sm hover:shadow-[0_12px_30px_rgba(139,92,246,0.08)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer opacity-0 branch-card-animate";
        card.style.animationDelay = `${index * 30}ms`;
        
        card.onclick = () => {
            toggleHlcExpand(card);
        };

        const instsHtml = hlc.instructions.map(inst => `<li>${inst}</li>`).join('');

        card.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="space-y-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="bg-purple-100/90 text-purple-700 font-extrabold text-[10px] px-2.5 py-0.5 rounded-lg border border-purple-200/30 shadow-sm">${hlc.code}</span>
                        <span class="bg-slate-100 text-slate-600 font-extrabold text-[10px] px-2.5 py-0.5 rounded-lg border border-slate-200/30 uppercase tracking-wide shadow-sm">${hlc.district}</span>
                        <span class="bg-green-50 text-green-700 font-extrabold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-green-100 flex items-center gap-1 shadow-sm">
                            <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            Verified Centre
                        </span>
                    </div>
                    <h4 class="font-extrabold text-slate-800 text-base leading-snug">${hlc.name}</h4>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-semibold">
                        <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> ${hlc.place}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 self-end sm:self-center">
                    <div class="p-2 hover:bg-slate-100/80 rounded-xl text-slate-400 transition-colors">
                        <i data-lucide="chevron-down" class="w-5 h-5 transition-transform duration-300 expand-icon"></i>
                    </div>
                </div>
            </div>
            
            <div class="hlc-details hidden mt-5 pt-5 border-t border-slate-100 space-y-4" onclick="event.stopPropagation();">
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <i data-lucide="activity" class="w-3.5 h-3.5"></i> Supported Activities
                        </span>
                        <p class="text-xs text-slate-600 bg-slate-50 border border-slate-200/40 p-3 rounded-xl font-semibold leading-relaxed">
                            ${hlc.activities}
                        </p>
                    </div>
                    <div class="space-y-2">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <i data-lucide="clock" class="w-3.5 h-3.5"></i> Available Slot Timings
                        </span>
                        <p class="text-xs text-slate-500 leading-relaxed font-semibold">
                            Choose from 16 daily slots starting at 09:00 AM until 06:00 PM (30-minute intervals). Refer to your booking receipt for verification windows.
                        </p>
                    </div>
                </div>
                
                <div class="space-y-2 pt-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <i data-lucide="file-check" class="w-3.5 h-3.5"></i> Verification Instructions
                    </span>
                    <ul class="space-y-1.5 text-xs text-slate-600 list-disc list-inside pl-1 font-semibold leading-relaxed">
                        ${instsHtml}
                    </ul>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

function toggleHlcExpand(card) {
    const details = card.querySelector('.hlc-details');
    const icon = card.querySelector('.expand-icon');
    if (details) {
        details.classList.toggle('hidden');
        if (icon) {
            icon.classList.toggle('rotate-180');
        }
    }
}

function filterHlcs() {
    populateHlcs();
}

// ================= MOCK OPTION ENTRY LOGIC =================
function renderMockOptions() {
    const container = document.getElementById('mock-options-container');
    if (!container) return;
    container.innerHTML = "";

    if (mockOptionsList.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-xs">No options selected yet. Select a college on the left to add!</div>`;
        return;
    }

    mockOptionsList.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="w-7 h-7 bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs rounded-lg">${index + 1}</span>
                <div>
                    <h4 class="font-bold text-slate-800 text-xs sm:text-sm">${item.college}</h4>
                    <span class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-extrabold">${item.branch}</span>
                </div>
            </div>
            <button onclick="removeMockOption(${index})" class="text-rose-500 hover:text-rose-700 p-1"><i data-lucide="trash" class="w-4 h-4"></i></button>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function populateMockColleges() {
    const selectCollege = document.getElementById('mock-college');
    if (!selectCollege) return;
    
    selectCollege.innerHTML = "";
    const sortedColleges = [...collegesDataset].sort((a, b) => a.name.localeCompare(b.name));
    sortedColleges.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.inst_code;
        opt.innerText = `${col.name} (${col.inst_code})`;
        selectCollege.appendChild(opt);
    });
    
    selectCollege.onchange = updateMockBranches;
    updateMockBranches();
}

function updateMockBranches() {
    const selectCollege = document.getElementById('mock-college');
    const selectBranch = document.getElementById('mock-branch');
    if (!selectCollege || !selectBranch) return;
    
    const instCode = selectCollege.value;
    const college = collegesDatasetMap[instCode];
    selectBranch.innerHTML = "";
    
    if (college && college.branches) {
        Object.keys(college.branches).forEach(bCode => {
            const opt = document.createElement('option');
            opt.value = bCode;
            opt.innerText = `${bCode} - ${college.branches[bCode].name}`;
            selectBranch.appendChild(opt);
        });
    }
}

function addMockOption() {
    const collegeCode = document.getElementById('mock-college').value;
    const branch = document.getElementById('mock-branch').value;
    
    const college = collegesDatasetMap[collegeCode];
    const collegeLabel = college ? `${college.name} (${college.inst_code})` : collegeCode;

    // Check if already duplicate
    const exists = mockOptionsList.some(item => item.college === collegeLabel && item.branch === branch);
    if (exists) {
        showToast("Duplicate Choice", "This option combination is already added.", "alert-triangle");
        return;
    }

    mockOptionsList.push({ college: collegeLabel, branch });
    renderMockOptions();
    showToast("Option Added", "Locked choice added to temporary sheet.", "plus-circle");
}

function removeMockOption(index) {
    mockOptionsList.splice(index, 1);
    renderMockOptions();
}

function clearMockOptions() {
    mockOptionsList = [];
    renderMockOptions();
    showToast("Sheet Cleared", "Mock Option Entry workspace cleared.", "trash");
}

// ================= DYNAMIC BRANCH EXPLORER =================
let activeBranchFilter = 'all';

function getBranchCategory(code, name) {
    const codeUpper = code.toUpperCase();
    const nameUpper = name.toUpperCase();
    if (['CSE', 'INF', 'IT', 'CME', 'CSW'].includes(codeUpper)) return 'Core Tech';
    if (codeUpper.startsWith('CS') || codeUpper.startsWith('AI') || nameUpper.includes('ARTIFICIAL') || nameUpper.includes('DATA SCIENCE')) return 'AI & Data Science';
    if (['ECE', 'EEE', 'EIE', 'EVL', 'ETM', 'ECI', 'ECM', 'BME'].includes(codeUpper)) return 'Circuit Branches';
    if (['MEC', 'CIV', 'CHE', 'MET', 'MIN', 'MCT', 'TEX', 'AGR', 'ANE', 'AUT', 'GEO'].includes(codeUpper)) return 'Core Engineering';
    return 'Specialized / Other';
}

const BRANCH_DESCRIPTIONS = {
    'CSE': 'The study of software design, algorithmic theory, hardware-software integration, and advanced database architectures. Widely preferred with excellent career scopes.',
    'CSM': 'Specialized Computer Science track targeting Neural networks, Machine learning libraries, automated inference systems, and intelligence-driven software design.',
    'CSD': 'Focuses on large scale data processing, statistical visualization pipelines, database warehouse management, and high-performance big data programming.',
    'ECE': 'Combines hardware electronics logic with communication network programming. Focuses on VLSI microchips, embedded processors, antenna systems, and cellular signal flows.',
    'EEE': 'Covers power grids, high voltage transformers, electrical machine controls, power converters, renewable energy systems, and electrical hardware engineering.',
    'INF': 'Focuses on database design, web application layers, cloud deployment systems, system security, and computing tools for business environments.',
    'CIV': 'Focuses on structural engineering designs, foundation dynamics, material stresses, water management, highway routing, and municipal development planning.',
    'MEC': 'The engineering study of fluid dynamics, solid stress testing, thermochemical systems, automotive engineering, manufacturing mechanics, and materials.'
};

function getBranchDescription(code, name) {
    if (BRANCH_DESCRIPTIONS[code]) return BRANCH_DESCRIPTIONS[code];
    return `A specialized technical branch of engineering focusing on the principles, architectures, and practical applications of ${name.toLowerCase()}.`;
}

function initBranchExplorer() {
    const container = document.getElementById('branches-container');
    if (!container) return;
    container.innerHTML = "";

    branchesDataset.forEach((branch, index) => {
        const category = getBranchCategory(branch.code, branch.name);
        
        // Calculate offering colleges count
        let collegeCount = 0;
        let topCutoff = 999999;
        let topCollege = "";

        collegesDataset.forEach(col => {
            if (col.branches && col.branches[branch.code]) {
                collegeCount++;
                // Check for OC BOYS cutoff in phase1
                const cutoffVal = col.branches[branch.code].cutoffs?.phase1?.OC_BOYS;
                if (cutoffVal && cutoffVal < topCutoff) {
                    topCutoff = cutoffVal;
                    topCollege = col.inst_code;
                }
            }
        });

        // Choose visual colors based on category
        let tagClass;
        let cardBorderClass;
        if (category === 'Core Tech') {
            tagClass = "bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100";
            cardBorderClass = "hover:border-purple-300/80 hover:shadow-purple-500/5";
        } else if (category === 'AI & Data Science') {
            tagClass = "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 hover:bg-fuchsia-100";
            cardBorderClass = "hover:border-fuchsia-300/80 hover:shadow-fuchsia-500/5";
        } else if (category === 'Circuit Branches') {
            tagClass = "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100";
            cardBorderClass = "hover:border-blue-300/80 hover:shadow-blue-500/5";
        } else if (category === 'Core Engineering') {
            tagClass = "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100";
            cardBorderClass = "hover:border-amber-300/80 hover:shadow-amber-500/5";
        } else {
            tagClass = "bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100";
            cardBorderClass = "hover:border-slate-300/80 hover:shadow-slate-500/5";
        }

        const desc = getBranchDescription(branch.code, branch.name);
        const card = document.createElement('div');
        card.className = `branch-card branch-card-animate bg-white/95 rounded-[2rem] border border-slate-200/60 p-7 shadow-sm transition-all duration-500 flex flex-col justify-between opacity-0 ${cardBorderClass}`;
        card.style.animationDelay = `${index * 30}ms`;
        card.setAttribute('data-category', category);
        card.setAttribute('data-code', branch.code.toLowerCase());
        card.setAttribute('data-name', branch.name.toLowerCase());

        card.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-start justify-between gap-3">
                    <span class="inline-block text-[10px] font-extrabold tracking-wider px-3 py-1 rounded-lg border uppercase transition-colors shadow-sm ${tagClass}">${category}</span>
                    <span class="text-xs font-black text-slate-400 bg-slate-100/60 px-2 py-0.5 rounded border border-slate-200/40">${branch.code}</span>
                </div>
                <h3 class="font-extrabold text-slate-800 text-xl tracking-tight leading-snug">${branch.name}</h3>
                <p class="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">${desc}</p>
            </div>

            <div class="pt-6 mt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shadow-sm">
                        <i data-lucide="building" class="w-4 h-4"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Offered At</span>
                        <span class="text-xs font-black text-slate-700">${collegeCount} Colleges</span>
                    </div>
                </div>
                ${topCollege ? `
                <div class="flex items-center gap-2.5 text-right justify-end">
                    <div class="flex flex-col">
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Top Cutoff</span>
                        <span class="text-xs font-black text-purple-600">${topCutoff.toLocaleString()} <span class="text-[10px] text-slate-400 font-bold uppercase">(${topCollege})</span></span>
                    </div>
                    <div class="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100/30 flex items-center justify-center text-purple-500 shadow-sm">
                        <i data-lucide="trending-up" class="w-4 h-4"></i>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Expandable Top 5 Colleges Row -->
            <div class="mt-4 pt-3 border-t border-dashed border-slate-100/80">
                <button onclick="toggleBranchColleges(this, '${branch.code}')" class="w-full text-left text-xs font-black text-purple-600 hover:text-purple-700 flex items-center justify-between group/btn py-1">
                    <span class="flex items-center gap-1.5"><i data-lucide="search" class="w-3.5 h-3.5 text-purple-400 group-hover/btn:text-purple-600 transition-colors"></i> View Top 5 Colleges & Cutoff Trends</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform duration-300"></i>
                </button>
                <div class="branch-colleges-list hidden mt-3 space-y-2.5 text-xs text-slate-600 transition-all duration-300">
                    <!-- Populated dynamically on expand -->
                </div>
            </div>
        `;

        container.appendChild(card);
    });
    lucide.createIcons();
}

function toggleBranchColleges(btn, branchCode) {
    const listDiv = btn.nextElementSibling;
    
    if (listDiv.classList.contains('hidden')) {
        // Populate top colleges
        listDiv.innerHTML = `<div class="py-2 text-center text-slate-400">Loading colleges...</div>`;
        listDiv.classList.remove('hidden');
        btn.querySelector('.transition-transform').classList.add('rotate-180');
        
        // Get all colleges offering this branch
        const offeringColleges = [];
        collegesDataset.forEach(col => {
            if (col.branches && col.branches[branchCode]) {
                const cutoffs = col.branches[branchCode].cutoffs;
                const p1oc = cutoffs?.phase1?.OC_BOYS || 999999;
                offeringColleges.push({
                    code: col.inst_code,
                    name: col.name,
                    district: col.district,
                    fee: col.fee,
                    p1: cutoffs?.phase1?.OC_BOYS || null,
                    p2: cutoffs?.phase2?.OC_BOYS || null,
                    final: cutoffs?.finalPhase?.OC_BOYS || null,
                    sortVal: p1oc
                });
            }
        });

        // Sort and slice top 5
        offeringColleges.sort((a, b) => a.sortVal - b.sortVal);
        const top5 = offeringColleges.slice(0, 5);

        if (top5.length === 0) {
            listDiv.innerHTML = `<div class="py-2 text-center text-slate-400">No cutoff data available.</div>`;
            return;
        }

        let html = `
            <div class="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-200/50">
                            <th class="pb-1.5 pl-2">College</th>
                            <th class="pb-1.5 text-center">Phase 1</th>
                            <th class="pb-1.5 text-center">Phase 2</th>
                            <th class="pb-1.5 text-center">Final Phase</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100/60">
        `;

        top5.forEach(col => {
            html += `
                <tr class="hover:bg-slate-100/50">
                    <td class="py-2 pl-2">
                        <span class="font-extrabold text-purple-700">${col.code}</span>
                        <span class="block text-[10px] text-slate-400 font-medium truncate max-w-[150px]" title="${col.name}">${col.name}</span>
                    </td>
                    <td class="py-2 text-center font-semibold text-slate-700">${col.p1 ? col.p1.toLocaleString() : '-'}</td>
                    <td class="py-2 text-center font-semibold text-slate-700">${col.p2 ? col.p2.toLocaleString() : '-'}</td>
                    <td class="py-2 text-center font-semibold text-slate-700">${col.final ? col.final.toLocaleString() : '-'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        listDiv.innerHTML = html;
    } else {
        listDiv.classList.add('hidden');
        btn.querySelector('.transition-transform').classList.remove('rotate-180');
    }
}

function filterBranches(category, btn) {
    activeBranchFilter = category;
    
    // Toggle button states using classList
    document.querySelectorAll('.branch-filter-btn').forEach(b => {
        b.classList.remove('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-100/50', 'scale-[1.02]');
        b.classList.add('bg-white', 'border-slate-200', 'text-slate-600', 'hover:bg-slate-50', 'hover:border-purple-200');
    });
    btn.classList.add('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-100/50', 'scale-[1.02]');
    btn.classList.remove('bg-white', 'border-slate-200', 'text-slate-600', 'hover:bg-slate-50', 'hover:border-purple-200');

    applyBranchFilters();
}

// Global search function
function searchBranches() {
    applyBranchFilters();
}

function applyBranchFilters() {
    const query = document.getElementById('branch-search').value.toLowerCase();
    const cards = document.querySelectorAll('.branch-card');

    cards.forEach(card => {
        const category = card.getAttribute('data-category');
        const code = card.getAttribute('data-code');
        const name = card.getAttribute('data-name');

        const matchesCategory = (activeBranchFilter === 'all' || category === activeBranchFilter);
        const matchesQuery = (code.includes(query) || name.includes(query));

        if (matchesCategory && matchesQuery) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

// ================= DYNAMIC GENERATOR OPTIONS POPULATOR =================
function populateGeneratorBranches() {
    const container = document.getElementById('branch-chips');
    if (!container) return;
    container.innerHTML = "";

    // Calculate popularity (number of offering colleges)
    const branchPopularity = {};
    branchesDataset.forEach(b => {
        branchPopularity[b.code] = 0;
    });
    collegesDataset.forEach(col => {
        if (col.branches) {
            Object.keys(col.branches).forEach(bCode => {
                if (branchPopularity[bCode] !== undefined) {
                    branchPopularity[bCode]++;
                }
            });
        }
    });

    // Sort by popularity (descending)
    const sortedBranches = [...branchesDataset].sort((a, b) => {
        const countA = branchPopularity[a.code] || 0;
        const countB = branchPopularity[b.code] || 0;
        if (countB !== countA) return countB - countA;
        return a.code.localeCompare(b.code);
    });

    // Major branches checked by default initially
    const defaultChecked = ['CSE', 'CSM', 'CSD', 'INF', 'ECE'];

    sortedBranches.forEach(branch => {
        const isChecked = defaultChecked.includes(branch.code);
        const checkedStr = isChecked ? "checked" : "";

        const label = document.createElement('label');
        const activeClass = isChecked ? "chip-glow-selected" : "bg-slate-50 border-slate-200 text-slate-600";
        label.className = `flex items-center gap-1.5 px-4 py-2 border rounded-xl cursor-pointer text-xs font-bold transition-all branch-option-chip ${activeClass}`;
        label.setAttribute('data-code', branch.code.toLowerCase());
        label.setAttribute('data-name', branch.name.toLowerCase());
        label.setAttribute('title', `${branch.name} (${branch.code})`);
        label.innerHTML = `
            <input type="checkbox" value="${branch.code}" ${checkedStr} onchange="onGeneratorSelectionChange()"
                class="rounded border-slate-300 text-purple-600 focus:ring-purple-400 w-4 h-4 transition-all">
            <span>${branch.code}</span>
        `;
        container.appendChild(label);
    });
    
    updateChipsStyling();
    lucide.createIcons();
}

function filterGeneratorBranches() {
    const query = document.getElementById('generator-branch-search').value.toLowerCase().trim();
    const chips = document.querySelectorAll('.branch-option-chip');
    chips.forEach(chip => {
        const code = chip.getAttribute('data-code');
        const name = chip.getAttribute('data-name');
        if (code.includes(query) || name.includes(query)) {
            chip.style.display = "flex";
        } else {
            chip.style.display = "none";
        }
    });
}

function populateGeneratorDistricts() {
    const container = document.getElementById('district-checks');
    if (!container) return;
    container.innerHTML = "";

    // Count colleges per district
    const districtCounts = {};
    collegesDataset.forEach(col => {
        const dist = col.district;
        if (dist) {
            districtCounts[dist] = (districtCounts[dist] || 0) + 1;
        }
    });

    // Sort by count (descending)
    const sortedDistricts = Object.keys(districtCounts).sort((a, b) => {
        const countA = districtCounts[a] || 0;
        const countB = districtCounts[b] || 0;
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
    });

    // Major districts checked by default
    const defaultChecked = ['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Medchal', 'Warangal'];

    sortedDistricts.forEach(dist => {
        const isDefault = defaultChecked.some(def => dist.toLowerCase().includes(def.toLowerCase()));
        const checkedStr = isDefault ? "checked" : "";
        const count = districtCounts[dist];

        const label = document.createElement('label');
        const activeClass = isDefault ? "chip-glow-selected" : "bg-slate-50 border-slate-200 text-slate-600";
        label.className = `flex items-center gap-2 p-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all district-option-chip ${activeClass}`;
        label.setAttribute('data-district', dist.toLowerCase());
        label.innerHTML = `
            <input type="checkbox" value="${dist}" ${checkedStr} onchange="onGeneratorSelectionChange()"
                class="rounded border-slate-300 text-purple-600 focus:ring-purple-400 w-4 h-4 transition-all">
            <span class="truncate">${dist} <span class="text-[10px] text-slate-400 font-bold">(${count})</span></span>
        `;
        container.appendChild(label);
    });
    
    updateChipsStyling();
    lucide.createIcons();
}

function filterGeneratorDistricts() {
    const query = document.getElementById('generator-district-search').value.toLowerCase().trim();
    const chips = document.querySelectorAll('.district-option-chip');
    chips.forEach(chip => {
        const dist = chip.getAttribute('data-district');
        if (dist.includes(query)) {
            chip.style.display = "flex";
        } else {
            chip.style.display = "none";
        }
    });
}

function updateChipsStyling() {
    // 1. Branches Styling & Counter
    const branchChips = document.querySelectorAll('.branch-option-chip');
    let branchSelected = 0;
    let branchTotal = branchChips.length;
    
    branchChips.forEach(chip => {
        const input = chip.querySelector('input[type="checkbox"]');
        if (input && input.checked) {
            branchSelected++;
            chip.classList.add('chip-glow-selected');
            chip.classList.remove('bg-slate-50', 'border-slate-200', 'text-slate-600');
        } else {
            chip.classList.remove('chip-glow-selected');
            chip.classList.add('bg-slate-50', 'border-slate-200', 'text-slate-600');
        }
    });
    
    const branchCounter = document.getElementById('branch-select-counter');
    if (branchCounter) {
        branchCounter.innerText = `${branchSelected} Selected • ${branchTotal} Available`;
    }
    
    // 2. Districts Styling & Counter
    const districtChips = document.querySelectorAll('.district-option-chip');
    let districtSelected = 0;
    let districtTotal = districtChips.length;
    
    districtChips.forEach(chip => {
        const input = chip.querySelector('input[type="checkbox"]');
        if (input && input.checked) {
            districtSelected++;
            chip.classList.add('chip-glow-selected');
            chip.classList.remove('bg-slate-50', 'border-slate-200', 'text-slate-600');
        } else {
            chip.classList.remove('chip-glow-selected');
            chip.classList.add('bg-slate-50', 'border-slate-200', 'text-slate-600');
        }
    });
    
    const districtCounter = document.getElementById('district-select-counter');
    if (districtCounter) {
        districtCounter.innerText = `${districtSelected} Selected • ${districtTotal} Available`;
    }
}

function onGeneratorSelectionChange() {
    updateChipsStyling();
    generatePreferenceList();
    syncModalsWithSidebar();
}

function syncModalsWithSidebar() {
    // 1. Sync Branch Explorer if open
    const branchModal = document.getElementById('branch-explorer-modal');
    if (branchModal && !branchModal.classList.contains('hidden')) {
        updateBranchExplorerSelections();
    }
    
    // 2. Sync District Explorer if open
    const districtModal = document.getElementById('district-explorer-modal');
    if (districtModal && !districtModal.classList.contains('hidden')) {
        updateDistrictExplorerSelections();
    }
}

// ================= BRANCH EXPLORER WORKSPACE =================
function openBranchExplorerModal() {
    const modal = document.getElementById('branch-explorer-modal');
    const content = document.getElementById('branch-explorer-content');
    if (!modal || !content) return;
    
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    content.classList.add('modal-show');
    
    renderBranchExplorerModal();
    lucide.createIcons();
}

function closeBranchExplorerModal() {
    const modal = document.getElementById('branch-explorer-modal');
    const content = document.getElementById('branch-explorer-content');
    if (!modal || !content) return;
    
    content.classList.remove('modal-show');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function renderBranchExplorerModal() {
    const container = document.getElementById('modal-branch-groups-container');
    if (!container) return;
    container.innerHTML = "";
    
    // Compute offering college counts
    const branchPopularity = {};
    branchesDataset.forEach(b => {
        branchPopularity[b.code] = 0;
    });
    collegesDataset.forEach(col => {
        if (col.branches) {
            Object.keys(col.branches).forEach(bCode => {
                if (branchPopularity[bCode] !== undefined) {
                    branchPopularity[bCode]++;
                }
            });
        }
    });
    
    // Max offering colleges to normalize popularity indicator
    const maxColleges = Math.max(...Object.values(branchPopularity), 1);
    
    // Define Categories mapping
    const categories = ['Core Tech', 'AI & Data Science', 'Circuit Branches', 'Core Engineering', 'Specialized / Other'];
    const categoryDescriptions = {
        'Core Tech': 'High-demand computing, software architectural systems, and core IT infrastructure fields.',
        'AI & Data Science': 'State-of-the-art specialization branches focused on Machine Learning, Neural networks, big data statistics, and smart decision models.',
        'Circuit Branches': 'Core electronics, network flows, telecommunications, instrumentation, and electric grid logic.',
        'Core Engineering': 'Classical physical engineering disciplines comprising materials, fluid dynamics, design structures, chemistry, and civic development.',
        'Specialized / Other': 'Specialized hybrid technology and niche industrial engineering domains.'
    };
    
    categories.forEach(cat => {
        const catBranches = branchesDataset.filter(b => getBranchCategory(b.code, b.name) === cat);
        if (catBranches.length === 0) return;
        
        const catSection = document.createElement('div');
        catSection.className = "space-y-4 branch-modal-group-section";
        
        catSection.innerHTML = `
            <div class="border-b border-slate-200/60 pb-3">
                <h3 class="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span> ${cat}
                    <span class="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50 ml-1">${catBranches.length} Branches</span>
                </h3>
                <p class="text-[11px] text-slate-400 font-semibold mt-1">${categoryDescriptions[cat]}</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="modal-cat-grid-${cat.replace(/[^a-zA-Z]/g, '')}">
            </div>
        `;
        
        container.appendChild(catSection);
        
        const grid = document.getElementById(`modal-cat-grid-${cat.replace(/[^a-zA-Z]/g, '')}`);
        
        catBranches.forEach(branch => {
            const count = branchPopularity[branch.code] || 0;
            const popularityPct = Math.min(100, Math.round((count / maxColleges) * 100));
            const isChecked = isBranchSelectedInSidebar(branch.code);
            const activeCardClass = isChecked ? "card-selected-glow" : "bg-white border-slate-200/60 hover:-translate-y-1 hover:shadow-lg hover:border-purple-300";
            
            const card = document.createElement('div');
            card.className = `p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between select-none branch-modal-card ${activeCardClass}`;
            card.setAttribute('data-branch-code', branch.code);
            card.onclick = () => {
                toggleBranchExplorerSelection(branch.code);
            };
            
            const desc = getBranchDescription(branch.code, branch.name);
            
            card.innerHTML = `
                <div class="space-y-3">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded border border-purple-100/50">${branch.code}</span>
                            <span class="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded">${count} Colleges</span>
                        </div>
                        <div class="w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'bg-purple-600 border-purple-600 text-white check-pop' : 'border-slate-300'}" id="modal-branch-check-${branch.code}">
                            ${isChecked ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
                        </div>
                    </div>
                    <div class="space-y-1">
                        <h4 class="font-extrabold text-slate-800 text-xs sm:text-sm leading-snug">${branch.name}</h4>
                        <p class="text-[11px] text-slate-400 font-semibold leading-relaxed line-clamp-2" title="${desc}">${desc}</p>
                    </div>
                </div>
                
                <div class="mt-4 pt-3.5 border-t border-slate-100/80 space-y-1.5">
                    <div class="flex items-center justify-between text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                        <span>Colleges Density Ratio</span>
                        <span class="text-purple-600">${popularityPct}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500" style="width: ${popularityPct}%"></div>
                    </div>
                </div>
            `;
            
            grid.appendChild(card);
        });
    });
    
    updateBranchExplorerCounter();
}

function isBranchSelectedInSidebar(code) {
    const input = document.querySelector(`#branch-chips input[value="${code}"]`);
    return input ? input.checked : false;
}

function toggleBranchExplorerSelection(code) {
    const input = document.querySelector(`#branch-chips input[value="${code}"]`);
    if (input) {
        input.checked = !input.checked;
        onGeneratorSelectionChange();
    }
}

function updateBranchExplorerSelections() {
    const cards = document.querySelectorAll('.branch-modal-card');
    cards.forEach(card => {
        const code = card.getAttribute('data-branch-code');
        const isChecked = isBranchSelectedInSidebar(code);
        const checkEl = document.getElementById(`modal-branch-check-${code}`);
        
        if (isChecked) {
            card.className = `p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between select-none branch-modal-card card-selected-glow`;
            if (checkEl) {
                checkEl.className = "w-5 h-5 rounded-md border flex items-center justify-center transition-all bg-purple-600 border-purple-600 text-white check-pop";
                checkEl.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>';
            }
        } else {
            card.className = `p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between select-none branch-modal-card bg-white border-slate-200/60 hover:-translate-y-1 hover:shadow-lg hover:border-purple-300`;
            if (checkEl) {
                checkEl.className = "w-5 h-5 rounded-md border flex items-center justify-center transition-all border-slate-300";
                checkEl.innerHTML = '';
            }
        }
    });
    
    updateBranchExplorerCounter();
    lucide.createIcons();
}

function updateBranchExplorerCounter() {
    const branchChips = document.querySelectorAll('#branch-chips input[type="checkbox"]');
    const selectedCount = Array.from(branchChips).filter(cb => cb.checked).length;
    const totalCount = branchChips.length;
    
    const modalCounter = document.getElementById('modal-branch-counter');
    if (modalCounter) {
        modalCounter.innerText = `${selectedCount} Selected • ${totalCount} Available`;
    }
}

function filterModalBranches() {
    const query = document.getElementById('modal-branch-search').value.toLowerCase().trim();
    const cards = document.querySelectorAll('.branch-modal-card');
    
    cards.forEach(card => {
        const code = card.getAttribute('data-branch-code').toLowerCase();
        const nameEl = card.querySelector('h4');
        const name = nameEl ? nameEl.innerText.toLowerCase() : '';
        const descEl = card.querySelector('p');
        const desc = descEl ? descEl.innerText.toLowerCase() : '';
        
        if (code.includes(query) || name.includes(query) || desc.includes(query)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
    
    // Toggle empty categories
    document.querySelectorAll('.branch-modal-group-section').forEach(section => {
        const grid = section.querySelector('div[id^="modal-cat-grid-"]');
        if (grid) {
            const cardsInGrid = grid.querySelectorAll('.branch-modal-card');
            const visibleCards = Array.from(cardsInGrid).filter(c => c.style.display !== "none");
            if (visibleCards.length === 0) {
                section.style.display = "none";
            } else {
                section.style.display = "block";
            }
        }
    });
}

function quickSelectBranches(mode) {
    const checkboxes = document.querySelectorAll('#branch-chips input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const code = cb.value;
        const cat = getBranchCategory(code, "");
        if (mode === 'all') {
            cb.checked = true;
        } else if (mode === 'none') {
            cb.checked = false;
        } else if (mode === 'tech') {
            cb.checked = (cat === 'Core Tech' || cat === 'AI & Data Science');
        } else if (mode === 'circuit') {
            cb.checked = (cat === 'Circuit Branches');
        }
    });
    
    onGeneratorSelectionChange();
}

// ================= DISTRICT EXPLORER WORKSPACE =================
function openDistrictExplorerModal() {
    const modal = document.getElementById('district-explorer-modal');
    const content = document.getElementById('district-explorer-content');
    if (!modal || !content) return;
    
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    content.classList.add('modal-show');
    
    renderDistrictExplorerModal();
    renderGeneratorMap();
    lucide.createIcons();
}

function closeDistrictExplorerModal() {
    const modal = document.getElementById('district-explorer-modal');
    const content = document.getElementById('district-explorer-content');
    if (!modal || !content) return;
    
    content.classList.remove('modal-show');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function renderDistrictExplorerModal() {
    const container = document.getElementById('modal-districts-grid-container');
    if (!container) return;
    container.innerHTML = "";
    
    // Count colleges per district
    const districtCounts = {};
    collegesDataset.forEach(col => {
        const dist = col.district;
        if (dist) {
            districtCounts[dist] = (districtCounts[dist] || 0) + 1;
        }
    });
    
    const sortedDistricts = Object.keys(districtCounts).sort((a, b) => {
        const countA = districtCounts[a] || 0;
        const countB = districtCounts[b] || 0;
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
    });
    
    sortedDistricts.forEach(dist => {
        const count = districtCounts[dist] || 0;
        const isChecked = isDistrictSelectedInSidebar(dist);
        const activeCardClass = isChecked ? "card-selected-glow" : "bg-white border-slate-200/60 hover:-translate-y-1 hover:shadow-lg hover:border-purple-300";
        
        let densityText = "Low Density";
        let densityBadgeClass = "bg-purple-50 text-purple-600 border-purple-100";
        if (count > 20) {
            densityText = "High Density";
            densityBadgeClass = "bg-purple-600 text-white border-purple-700 shadow-sm shadow-purple-100";
        } else if (count >= 6) {
            densityText = "Medium Density";
            densityBadgeClass = "bg-purple-200 text-purple-800 border-purple-300";
        }
        
        const card = document.createElement('div');
        card.className = `p-4 min-h-[82px] rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between select-none district-modal-card ${activeCardClass}`;
        card.setAttribute('data-district-name', dist);
        card.onclick = () => {
            toggleDistrictExplorerSelection(dist);
        };
        
        card.innerHTML = `
            <div class="flex-1 min-w-0 mr-4 flex flex-col justify-between h-full space-y-1.5">
                <h4 class="font-extrabold text-slate-800 text-xs sm:text-sm leading-snug break-words">${dist}</h4>
                <div class="flex flex-wrap items-center gap-1.5 mt-auto">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${count} Colleges</span>
                    <span class="text-[9px] font-extrabold border px-2 py-0.5 rounded-md whitespace-nowrap ${densityBadgeClass}">${densityText}</span>
                </div>
            </div>
            <div class="flex-shrink-0 w-5.5 h-5.5 rounded-lg border flex items-center justify-center self-center transition-all ${isChecked ? 'bg-purple-600 border-purple-600 text-white check-pop shadow-md shadow-purple-100' : 'border-slate-300 bg-white'}" id="modal-district-check-${dist.replace(/[^a-zA-Z]/g, '-')}">
                ${isChecked ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
            </div>
        `;
        
        container.appendChild(card);
    });
    
    updateDistrictExplorerCounter();
}

function isDistrictSelectedInSidebar(dist) {
    const input = document.querySelector(`#district-checks input[value="${dist}"]`);
    return input ? input.checked : false;
}

function toggleDistrictExplorerSelection(dist) {
    const input = document.querySelector(`#district-checks input[value="${dist}"]`);
    if (input) {
        input.checked = !input.checked;
        onGeneratorSelectionChange();
    }
}

function updateDistrictExplorerSelections() {
    const cards = document.querySelectorAll('.district-modal-card');
    cards.forEach(card => {
        const dist = card.getAttribute('data-district-name');
        const isChecked = isDistrictSelectedInSidebar(dist);
        const checkEl = document.getElementById(`modal-district-check-${dist.replace(/[^a-zA-Z]/g, '-')}`);
        
        if (isChecked) {
            card.className = "p-4 min-h-[82px] rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between select-none district-modal-card card-selected-glow";
            if (checkEl) {
                checkEl.className = "w-5.5 h-5.5 rounded-lg border flex items-center justify-center self-center transition-all bg-purple-600 border-purple-600 text-white check-pop shadow-md shadow-purple-100";
                checkEl.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>';
            }
        } else {
            card.className = "p-4 min-h-[82px] rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between select-none district-modal-card bg-white border-slate-200/60 hover:-translate-y-1 hover:shadow-lg hover:border-purple-300";
            if (checkEl) {
                checkEl.className = "w-5.5 h-5.5 rounded-lg border flex items-center justify-center self-center transition-all border-slate-300 bg-white";
                checkEl.innerHTML = '';
            }
        }
    });
    
    updateDistrictExplorerCounter();
    updateMapHighlights();
    lucide.createIcons();
}

function updateDistrictExplorerCounter() {
    const districtChips = document.querySelectorAll('#district-checks input[type="checkbox"]');
    const selectedCount = Array.from(districtChips).filter(cb => cb.checked).length;
    const totalCount = districtChips.length;
    
    let matchedColleges = 0;
    const chosenDistricts = Array.from(districtChips).filter(cb => cb.checked).map(cb => cb.value);
    
    collegesDataset.forEach(col => {
        if (chosenDistricts.length === 0 || chosenDistricts.includes(col.district)) {
            matchedColleges++;
        }
    });
    
    const modalCounter = document.getElementById('modal-district-counter');
    if (modalCounter) {
        modalCounter.innerText = `${selectedCount} Selected • ${totalCount} Available • Matching ${matchedColleges} Colleges`;
    }
}

function filterModalDistricts() {
    const query = document.getElementById('modal-district-search').value.toLowerCase().trim();
    const cards = document.querySelectorAll('.district-modal-card');
    
    cards.forEach(card => {
        const name = card.getAttribute('data-district-name').toLowerCase();
        if (name.includes(query)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

function toggleExplorerMap() {
    const mapPanel = document.getElementById('district-map-panel');
    const toggleText = document.getElementById('map-toggle-text');
    if (mapPanel) {
        const isCollapsed = mapPanel.classList.toggle('collapsed');
        if (toggleText) {
            toggleText.innerText = isCollapsed ? "Show Map" : "Hide Map";
        }
    }
}

function quickSelectDistricts(mode) {
    const checkboxes = document.querySelectorAll('#district-checks input[type="checkbox"]');
    
    // Calculate counts dynamically
    const districtCounts = {};
    collegesDataset.forEach(col => {
        const dist = col.district;
        if (dist) {
            districtCounts[dist] = (districtCounts[dist] || 0) + 1;
        }
    });

    // Calculate CSE Heavy districts dynamically (districts with CSE-family offerings)
    const cseCounts = {};
    collegesDataset.forEach(col => {
        const dist = col.district;
        if (dist && col.branches) {
            let hasCse = false;
            col.branches.forEach(b => {
                const code = (b.branch_code || b.code || "").toUpperCase();
                if (['CSE', 'CSM', 'CSD', 'AIM', 'AID', 'AI', 'CSC', 'INF', 'CSI', 'CIC', 'CSB'].includes(code)) {
                    hasCse = true;
                }
            });
            if (hasCse) {
                cseCounts[dist] = (cseCounts[dist] || 0) + 1;
            }
        }
    });
    const topCseDistricts = Object.keys(cseCounts)
        .sort((a, b) => cseCounts[b] - cseCounts[a])
        .slice(0, 6);

    // Calculate Govt Focus districts dynamically (at least 1 government or university college)
    const govtDistricts = new Set();
    collegesDataset.forEach(col => {
        const dist = col.district;
        if (dist) {
            const typeLower = (col.type || "").toLowerCase();
            const nameLower = (col.name || "").toLowerCase();
            const isGovt = typeLower.includes("univ") || typeLower.includes("govt") ||
                           nameLower.includes("govt") || nameLower.includes("government") || nameLower.includes("university");
            if (isGovt) {
                govtDistricts.add(dist);
            }
        }
    });

    const metroNames = ['hyderabad', 'medchal', 'rangareddy', 'ranga reddy'];
    const northNames = [
        'adilabad', 'nirmal', 'mancherial', 'komaram bheem', 'nizamabad', 
        'kamareddy', 'jagtial', 'peddapalli', 'karimnagar', 'rajanna', 
        'medak', 'sangareddy', 'siddipet', 'warangal(urban)', 'warangal(rural)', 
        'warangal', 'hanamakonda', 'jangaon', 'jayashankar', 'mahabubabad', 
        'bhadradri', 'khammam'
    ];
    const southNames = [
        'hyderabad', 'medchal', 'rangareddy', 'ranga reddy', 'vikarabad', 
        'yadadri', 'nalgonda', 'suryapet', 'mahbubnagar', 'wanaparthy', 
        'gadwal', 'jogulamba', 'nagarkurnool'
    ];

    checkboxes.forEach(cb => {
        const dist = cb.value;
        const distLower = dist.toLowerCase();
        
        if (mode === 'all') {
            cb.checked = true;
        } else if (mode === 'none') {
            cb.checked = false;
        } else if (mode === 'metro') {
            cb.checked = metroNames.some(m => distLower.includes(m));
        } else if (mode === 'north') {
            cb.checked = northNames.some(n => distLower.includes(n));
        } else if (mode === 'south') {
            cb.checked = southNames.some(s => distLower.includes(s));
        } else if (mode === 'density') {
            cb.checked = (districtCounts[dist] || 0) >= 8;
        } else if (mode === 'cse') {
            cb.checked = topCseDistricts.includes(dist);
        } else if (mode === 'govt') {
            cb.checked = govtDistricts.has(dist);
        }
    });
    
    onGeneratorSelectionChange();
}

// ================= GEOGRAPHIC GIS MAP RENDERING =================
function renderGeneratorMap() {
    const svg = document.getElementById('generator-map-svg');
    if (!svg) return;

    svg.innerHTML = `
        <text x="464" y="440" text-anchor="middle" class="fill-slate-400 font-extrabold animate-pulse text-sm">
            Loading Interactive GIS Map...
        </text>
    `;

    fetch('/telangana_districts.svg')
        .then(response => {
            if (!response.ok) throw new Error('SVG map file not loaded');
            return response.text();
        })
        .then(svgText => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const paths = xmlDoc.querySelectorAll('path.tel');
            
            svg.innerHTML = `
                <defs>
                    <linearGradient id="grad-density-low" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#f8fafc" />
                        <stop offset="100%" stop-color="#f1f5f9" />
                    </linearGradient>
                    <linearGradient id="grad-density-med" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#f5f3ff" />
                        <stop offset="100%" stop-color="#e9d5ff" />
                    </linearGradient>
                    <linearGradient id="grad-density-high" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ddd6fe" />
                        <stop offset="100%" stop-color="#c084fc" />
                    </linearGradient>
                    <linearGradient id="grad-density-selected" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#c084fc" />
                        <stop offset="100%" stop-color="#818cf8" />
                    </linearGradient>
                    <linearGradient id="grad-density-active" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#818cf8" />
                        <stop offset="100%" stop-color="#4f46e5" />
                    </linearGradient>
                    
                    <filter id="generator-map-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
            `;

            // Calculate district counts
            const districtCounts = {};
            collegesDataset.forEach(col => {
                const dist = col.district;
                if (dist) {
                    districtCounts[dist] = (districtCounts[dist] || 0) + 1;
                }
            });

            // 1. Render all district paths first
            // 1. Render all district paths
            paths.forEach(path => {
                const svgName = path.getAttribute('name');
                const d = path.getAttribute('d');
                
                // Match key from sidebar checkboxes
                let datasetDistrictName = "";
                const checkbox = Array.from(document.querySelectorAll('#district-checks input')).find(cb => {
                    return cb.value.toLowerCase().includes(svgName.toLowerCase()) || svgName.toLowerCase().includes(cb.value.toLowerCase());
                });
                if (checkbox) {
                    datasetDistrictName = checkbox.value;
                }

                const collegeCount = datasetDistrictName ? (districtCounts[datasetDistrictName] || 0) : 0;
                const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pathEl.setAttribute("d", d);
                
                const pathIdSafe = svgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                pathEl.setAttribute("id", `gen-map-path-${pathIdSafe}`);
                
                const isSelected = datasetDistrictName ? isDistrictSelectedInSidebar(datasetDistrictName) : false;
                
                let baseClasses = "map-district-path ";
                
                if (isSelected) {
                    baseClasses += "map-district-selected ";
                } else if (collegeCount > 20) {
                    baseClasses += "map-density-high ";
                } else if (collegeCount >= 6) {
                    baseClasses += "map-density-medium ";
                } else if (collegeCount > 0) {
                    baseClasses += "map-density-low ";
                } else {
                    baseClasses += "map-density-none ";
                }
                
                pathEl.setAttribute("class", baseClasses);
                
                pathEl.onmouseenter = () => {
                    const dotG = document.getElementById(`gen-map-dot-${pathIdSafe}`);
                    if (dotG) dotG.classList.add('hovered');
                };
                pathEl.onmouseleave = () => {
                    const dotG = document.getElementById(`gen-map-dot-${pathIdSafe}`);
                    if (dotG) dotG.classList.remove('hovered');
                };
                
                if (datasetDistrictName) {
                    pathEl.onclick = () => {
                        toggleDistrictExplorerSelection(datasetDistrictName);
                    };
                }
                
                svg.appendChild(pathEl);
            });

            // 2. Draw Bold outer state outline on top of districts
            const outerPath = xmlDoc.getElementById('path3725');
            if (outerPath) {
                const outerBorderEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                outerBorderEl.setAttribute("d", outerPath.getAttribute('d'));
                outerBorderEl.setAttribute("class", "map-outer-border");
                svg.appendChild(outerBorderEl);
            }

            // 3. Draw Dots and Labels
            Object.keys(DISTRICT_CENTROIDS).forEach(districtName => {
                const centroid = DISTRICT_CENTROIDS[districtName];
                
                let datasetDistrictName = "";
                const checkbox = Array.from(document.querySelectorAll('#district-checks input')).find(cb => {
                    return cb.value.toLowerCase().includes(districtName.toLowerCase()) || districtName.toLowerCase().includes(cb.value.toLowerCase());
                });
                if (checkbox) {
                    datasetDistrictName = checkbox.value;
                }
                
                if (datasetDistrictName) {
                    const isSelected = isDistrictSelectedInSidebar(datasetDistrictName);
                    
                    const dotG = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    const dotIdSafe = districtName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    dotG.setAttribute("class", `gen-district-dot-group cursor-pointer transition-all duration-300 ${isSelected ? 'selected' : ''}`);
                    dotG.setAttribute("id", `gen-map-dot-${dotIdSafe}`);
                    
                    dotG.onclick = () => {
                        toggleDistrictExplorerSelection(datasetDistrictName);
                    };
                    
                    dotG.onmouseenter = () => {
                        const targetPath = document.getElementById(`gen-map-path-${dotIdSafe}`);
                        if (targetPath) targetPath.classList.add('hovered-path');
                    };
                    dotG.onmouseleave = () => {
                        const targetPath = document.getElementById(`gen-map-path-${dotIdSafe}`);
                        if (targetPath) targetPath.classList.remove('hovered-path');
                    };
                    
                    const pulseCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    pulseCircle.setAttribute("cx", centroid.x);
                    pulseCircle.setAttribute("cy", centroid.y);
                    pulseCircle.setAttribute("r", isSelected ? 15 : 10);
                    pulseCircle.setAttribute("class", `fill-purple-500/30 transition-all duration-300 ${isSelected ? 'animate-ping' : 'animate-pulse'}`);
                    dotG.appendChild(pulseCircle);
                    
                    const solidCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    solidCircle.setAttribute("cx", centroid.x);
                    solidCircle.setAttribute("cy", centroid.y);
                    solidCircle.setAttribute("r", isSelected ? 5 : 4);
                    solidCircle.setAttribute("class", isSelected ? "fill-purple-600 stroke-white stroke-2 shadow-sm" : "fill-slate-500 stroke-white stroke-2 shadow-sm");
                    dotG.appendChild(solidCircle);
                    
                    const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    textLabel.setAttribute("text-anchor", "middle");
                    
                    let labelClasses = "map-district-label ";
                    if (isSelected) {
                        labelClasses += "map-district-label-selected";
                    }
                    textLabel.setAttribute("class", labelClasses);
                    createWrappedSvgLabel(textLabel, districtName, centroid.x, centroid.y);
                    dotG.appendChild(textLabel);
                    
                    svg.appendChild(dotG);
                }
            });
        })
        .catch(err => {
            console.error('Error rendering interactive map:', err);
            svg.innerHTML = `<text x="464" y="440" text-anchor="middle" class="fill-rose-500 font-bold text-sm">Interactive Map Offline</text>`;
        });
}

function updateMapHighlights() {
    const districtChips = document.querySelectorAll('#district-checks input[type="checkbox"]');
    
    districtChips.forEach(cb => {
        const distName = cb.value;
        const isSelected = cb.checked;
        
        const matchKey = Object.keys(DISTRICT_MAPPING).find(key => {
            return distName.toLowerCase().includes(DISTRICT_MAPPING[key].toLowerCase()) || DISTRICT_MAPPING[key].toLowerCase().includes(distName.toLowerCase());
        });
        
        if (matchKey) {
            const svgName = DISTRICT_MAPPING[matchKey];
            const idSafe = svgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            
            // 1. Update Path
            const pathEl = document.getElementById(`gen-map-path-${idSafe}`);
            if (pathEl) {
                if (isSelected) {
                    pathEl.setAttribute("class", "map-district-path map-district-selected");
                } else {
                    const districtCounts = {};
                    collegesDataset.forEach(col => {
                        const dist = col.district;
                        if (dist) {
                            districtCounts[dist] = (districtCounts[dist] || 0) + 1;
                        }
                    });
                    const count = districtCounts[distName] || 0;
                    
                    let baseClasses = "map-district-path ";
                    if (count > 20) {
                        baseClasses += "map-density-high";
                    } else if (count >= 6) {
                        baseClasses += "map-density-medium";
                    } else if (count > 0) {
                        baseClasses += "map-density-low";
                    } else {
                        baseClasses += "map-density-none";
                    }
                    pathEl.setAttribute("class", baseClasses);
                }
            }
            
            // 2. Update Label Dots
            const dotG = document.getElementById(`gen-map-dot-${idSafe}`);
            if (dotG) {
                const pulseCircle = dotG.querySelectorAll('circle')[0];
                const solidCircle = dotG.querySelectorAll('circle')[1];
                const textLabel = dotG.querySelector('text');
                
                const sizeClass = getDistrictSizeClass(svgName);
                
                if (isSelected) {
                    dotG.classList.add('selected');
                    if (pulseCircle) {
                        pulseCircle.setAttribute("r", "15");
                        pulseCircle.setAttribute("class", "fill-purple-500/30 transition-all duration-300 animate-ping");
                    }
                    if (solidCircle) {
                        solidCircle.setAttribute("class", "fill-purple-600 stroke-white stroke-2 shadow-sm");
                    }
                    if (textLabel) {
                        textLabel.setAttribute("class", `map-district-label map-district-label-selected ${sizeClass}`);
                    }
                } else {
                    dotG.classList.remove('selected');
                    if (pulseCircle) {
                        pulseCircle.setAttribute("r", "10");
                        pulseCircle.setAttribute("class", "fill-purple-500/30 transition-all duration-300 animate-pulse");
                    }
                    if (solidCircle) {
                        solidCircle.setAttribute("class", "fill-slate-500 stroke-white stroke-2 shadow-sm");
                    }
                    if (textLabel) {
                        textLabel.setAttribute("class", `map-district-label ${sizeClass}`);
                    }
                }
            }
        }
    });
}


function updateDocProgress() {
    const checkboxes = document.querySelectorAll('.doc-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const docCountEl = document.getElementById('doc-count');
    if (docCountEl) {
        docCountEl.innerText = checkedCount;
    }
}

// Expose all interactive functions globally for inline HTML events
window.showView = showView;
window.toggleMobileMenu = toggleMobileMenu;
window.getExactCutoff = getExactCutoff;
window.getCutoffForPhase = getCutoffForPhase;
window.generatePreferenceList = generatePreferenceList;
window.closePlatformUpdatePopup = closePlatformUpdatePopup;
window.handlePopupExploreUpdates = handlePopupExploreUpdates;
window.renderPreferences = renderPreferences;
window.removeItem = removeItem;
window.moveItem = moveItem;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.exportToExcel = exportToExcel;
window.openPdfPreviewModal = openPdfPreviewModal;
window.closePdfPreviewModal = closePdfPreviewModal;
window.triggerPrintDoc = triggerPrintDoc;
window.saveCurrentList = saveCurrentList;
window.updateDocProgress = updateDocProgress;
window.filterGeneratorBranches = filterGeneratorBranches;
window.populateGeneratorBranches = populateGeneratorBranches;
window.populateGeneratorDistricts = populateGeneratorDistricts;
window.populateMockColleges = populateMockColleges;
window.updateMockBranches = updateMockBranches;
window.addMockOption = addMockOption;
window.removeMockOption = removeMockOption;
window.clearMockOptions = clearMockOptions;
window.filterBranches = filterBranches;
window.searchBranches = searchBranches;
window.applyBranchFilters = applyBranchFilters;
window.initBranchExplorer = initBranchExplorer;
window.toggleBranchColleges = toggleBranchColleges;
window.populateHlcs = populateHlcs;
window.filterHlcs = filterHlcs;
window.populateHlcDistrictChips = populateHlcDistrictChips;
window.filterHlcByDistrict = filterHlcByDistrict;
window.filterByMapRegion = filterByMapRegion;
window.toggleHlcExpand = toggleHlcExpand;
window.renderTelanganaMap = renderTelanganaMap;
window.showToast = showToast;

// =========================================================================
//                   COUNSELLING GUIDE SIMULATOR FUNCTIONS
// =========================================================================

let simPassword = "Demo@1234";
let simOtpTimerInterval = null;
let simSelectedDistricts = new Set(['HYDERABAD']);
let simSelectedBranches = new Set(['CSE', 'CSM']);
let simSavedOptions = []; // array of { priority, collegeCode, collegeName, branch, district, type }
let simSlotBookingState = {
    loggedIn: false,
    selectedCategory: "ALL",
    selectedHlcCode: "",
    selectedDate: "",
    selectedSlot: "",
    receipt: null
};

// Persistent candidate information
let simCandidateName = "Student Demo";
let simHallTicket = "2505XXXX92";
let simRank = 6917;
let simCategory = "EWS";
let simDetailsSet = false;
let simQuickLoadTargetScreen = 1;

function selectSimMode(mode) {
    const completeBtn = document.getElementById('sim-mode-btn-complete');
    const quickBtn = document.getElementById('sim-mode-btn-quick');
    const completePanel = document.getElementById('sim-mode-panel-complete');
    const quickPanel = document.getElementById('sim-mode-panel-quick');

    if (mode === 'complete') {
        if (completeBtn) completeBtn.className = "w-1/2 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 bg-white text-indigo-600 shadow-sm border border-slate-200/45";
        if (quickBtn) quickBtn.className = "w-1/2 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900";
        if (completePanel) completePanel.classList.remove('hidden');
        if (quickPanel) quickPanel.classList.add('hidden');
    } else {
        if (completeBtn) completeBtn.className = "w-1/2 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900";
        if (quickBtn) quickBtn.className = "w-1/2 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 bg-white text-indigo-600 shadow-sm border border-slate-200/45";
        if (completePanel) completePanel.classList.add('hidden');
        if (quickPanel) quickPanel.classList.remove('hidden');
    }
}

function handleNavNavigate(screenNum) {
    // Determine if target screen needs details config
    // 2 is processing fee, 7 is slot booking, 11 options candidate login, 17 seat allotment
    const needsDetails = (screenNum >= 11 || screenNum === 7);

    if (needsDetails && !simDetailsSet) {
        openSimQuickDetailsModal(screenNum);
    } else {
        if (screenNum === 17 || screenNum === 18 || screenNum === 19 || screenNum === 20 || screenNum === 21) {
            handleSimProceedToSeatAllotment();
        }
        showGuideScreen(screenNum);
    }
}

function openSimQuickDetailsModal(targetScreen) {
    simQuickLoadTargetScreen = targetScreen;
    
    const nameInp = document.getElementById('qd-name');
    if (nameInp) nameInp.value = simCandidateName;
    const ticketInp = document.getElementById('qd-ticket');
    if (ticketInp) ticketInp.value = simHallTicket;
    const rankInp = document.getElementById('qd-rank');
    if (rankInp) rankInp.value = simRank;
    const catSelect = document.getElementById('qd-category');
    if (catSelect) catSelect.value = simCategory;
    
    const collSelect = document.getElementById('qd-college');
    if (collSelect) collSelect.value = simAllottedCollegeCode;
    const brSelect = document.getElementById('qd-branch');
    if (brSelect) brSelect.value = simAllottedBranchCode;
    
    const modal = document.getElementById('sim-quick-details-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSimQuickDetailsModal() {
    const modal = document.getElementById('sim-quick-details-modal');
    if (modal) modal.classList.add('hidden');
}

function handleSimQuickDetailsSubmit() {
    const nameVal = document.getElementById('qd-name')?.value.trim();
    simCandidateName = maskName(nameVal || "Student Demo");
    
    const ticketVal = document.getElementById('qd-ticket')?.value.trim();
    simHallTicket = maskHallTicket(ticketVal || "2505XXXX92");
    
    const rankVal = parseInt(document.getElementById('qd-rank')?.value);
    simRank = isNaN(rankVal) ? 6917 : rankVal;
    
    const catVal = document.getElementById('qd-category')?.value;
    simCategory = catVal || "EWS";
    
    const collegeSelect = document.getElementById('qd-college');
    if (collegeSelect) {
        simAllottedCollegeCode = collegeSelect.value;
        const selectedCollegeText = collegeSelect.options[collegeSelect.selectedIndex].text;
        simAllottedCollege = selectedCollegeText.includes('-') ? selectedCollegeText.substring(selectedCollegeText.indexOf('-') + 2) : selectedCollegeText;
    }
    
    const branchSelect = document.getElementById('qd-branch');
    if (branchSelect) {
        simAllottedBranchCode = branchSelect.value;
        const selectedBranchText = branchSelect.options[branchSelect.selectedIndex].text;
        simAllottedBranch = selectedBranchText;
    }
    
    // Fetch tuition fee
    const collegeObj = collegesDataset.find(c => c.inst_code === simAllottedCollegeCode);
    const feeStr = collegeObj ? collegeObj.fee : "₹50,000";
    const parsedFee = parseInt(feeStr.replace(/[^\d]/g, ''));
    simTuitionFee = isNaN(parsedFee) ? 50000 : parsedFee;
    
    simFeeReimbursement = Math.min(35000, simTuitionFee);
    simNetFee = simTuitionFee - simFeeReimbursement;
    
    updateDOMCandidateDetails();
    
    simDetailsSet = true;
    closeSimQuickDetailsModal();
    
    if (simQuickLoadTargetScreen >= 17) {
        handleSimProceedToSeatAllotment();
    } else {
        showGuideScreen(simQuickLoadTargetScreen);
    }
}

function updateDOMCandidateDetails() {
    const maskedName = maskName(simCandidateName);
    const maskedTicket = maskHallTicket(simHallTicket);

    const nameEl = document.getElementById('sim-info-name');
    if (nameEl) nameEl.innerText = maskedName;
    const rankEl2 = document.getElementById('sim-info-rank');
    if (rankEl2) rankEl2.innerText = simRank;
    const catEl2 = document.getElementById('sim-info-category');
    if (catEl2) catEl2.innerText = simCategory;

    const rankEl2_2 = document.getElementById('sim-info-rank-2');
    if (rankEl2_2) rankEl2_2.innerText = simRank;
    const catEl2_2 = document.getElementById('sim-info-category-2');
    if (catEl2_2) catEl2_2.innerText = simCategory;
    
    const ticketInput = document.getElementById('sim-portal-ticket');
    if (ticketInput) ticketInput.value = maskedTicket;

    const name15 = document.getElementById('sim-info-name-15');
    if (name15) name15.innerText = maskedName;
    
    const name17 = document.getElementById('sim-info-name-17');
    if (name17) name17.innerText = maskedName;
    const ticket17 = document.getElementById('sim-info-ticket-17');
    if (ticket17) ticket17.innerText = maskedTicket;
    const rank17 = document.getElementById('sim-info-rank-17');
    if (rank17) rank17.innerText = simRank;
    const cat17 = document.getElementById('sim-info-category-17');
    if (cat17) cat17.innerText = `${simCategory} / BOYS`;
}

// Bind to window context
window.selectSimMode = selectSimMode;
window.handleNavNavigate = handleNavNavigate;
window.openSimQuickDetailsModal = openSimQuickDetailsModal;
window.closeSimQuickDetailsModal = closeSimQuickDetailsModal;
window.handleSimQuickDetailsSubmit = handleSimQuickDetailsSubmit;
window.updateDOMCandidateDetails = updateDOMCandidateDetails;

function showGuideScreen(screenNum) {
    const screens = ["1", "2", "3", "4", "5", "6", "7", "9", "10", "10-set", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"];
    screens.forEach(s => {
        const scr = document.getElementById(`guide-screen-${s}`);
        if (scr) {
            scr.classList.add('hidden');
            scr.classList.remove('animate-fade-in');
        }
    });
    const targetScr = document.getElementById(`guide-screen-${screenNum}`);
    if (targetScr) {
        targetScr.classList.remove('hidden');
        targetScr.classList.add('animate-fade-in');
    }

    // Trigger initialization hooks based on screen number
    if (screenNum === 14) {
        initSimFilters();
    } else if (screenNum === 15) {
        renderSimWorkspace();
    } else if (screenNum === 7) {
        initSlotBookingSection();
    }
}


function advanceFeeStep(stepNum) {
    // Hide all steps
    const steps = ['fee-step-login', 'fee-step-info', 'fee-step-gateway', 'fee-step-success'];
    steps.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });

    // Reset indicators
    for (let i = 1; i <= 3; i++) {
        const ind = document.getElementById(`fee-indicator-${i}`);
        const line = document.getElementById(`fee-line-${i}`);
        if (ind) {
            ind.className = i <= stepNum 
                ? "w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shadow-md shadow-purple-200 transition-all"
                : "w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold transition-all";
        }
        if (line) {
            line.className = i < stepNum 
                ? "w-8 h-1 bg-purple-600 rounded-full transition-all"
                : "w-8 h-1 bg-slate-100 rounded-full transition-all";
        }
    }

    const labels = ["", "Authentication", "Basic Information", "Payment Gateway"];
    const labelEl = document.getElementById('fee-step-label');
    if (labelEl && stepNum <= 3) {
        labelEl.innerText = labels[stepNum];
    }

    // Mentor tips
    const mentorTips = [
        "",
        "Login using your official hall ticket and registration numbers to retrieve your details.",
        "Verify your auto-fetched details. Enter valid certificate IDs and mobile number.",
        "Select your preferred gateway. Do not refresh the page during transaction processing."
    ];
    const mentorEl = document.getElementById('fee-mentor-text');
    if (mentorEl && stepNum <= 3) {
        mentorEl.innerText = mentorTips[stepNum];
    }

    if (stepNum === 1) {
        document.getElementById('fee-step-login')?.classList.remove('hidden');
    } else if (stepNum === 2) {
        // Validate login first if coming from 1 (optional, assuming success)
        const hallTicket = document.getElementById('spa-fee-ticket')?.value.trim();
        const captcha = document.getElementById('spa-fee-captcha')?.value.trim();
        if (captcha && captcha.toUpperCase() !== "A9B8C") {
            showToast("Invalid Captcha", "The security verification captcha is incorrect.", "alert-triangle");
            advanceFeeStep(1);
            return;
        }
        if (hallTicket) {
            simHallTicket = hallTicket;
            simDetailsSet = true;
            updateDOMCandidateDetails();
        }
        document.getElementById('fee-step-info')?.classList.remove('hidden');
    } else if (stepNum === 3) {
        document.getElementById('fee-step-gateway')?.classList.remove('hidden');
    } else if (stepNum === 4) {
        document.getElementById('fee-step-success')?.classList.remove('hidden');
        if (labelEl) labelEl.innerText = "Payment Completed";
        if (mentorEl) mentorEl.innerText = "Payment successful. Please proceed to verify the payment status.";
    }
}

function simulateFeePaymentProcess() {
    const actions = document.getElementById('fee-payment-actions');
    const loader = document.getElementById('fee-payment-loader-overlay');
    
    if (actions) actions.classList.add('hidden');
    if (loader) {
        loader.classList.remove('hidden');
        loader.classList.add('flex');
    }

    setTimeout(() => {
        if (actions) actions.classList.remove('hidden');
        if (loader) {
            loader.classList.add('hidden');
            loader.classList.remove('flex');
        }
        showToast("Payment Successful", "Processing Fee Paid Successfully!", "check-circle");
        advanceFeeStep(4);
    }, 2500);
}

function simulateVerificationProcess() {
    const formContainer = document.getElementById('verify-form-container');
    const loaderContainer = document.getElementById('verify-loader-container');
    const resultContainer = document.getElementById('verify-result-container');
    
    // reset
    if (resultContainer) {
        resultContainer.innerHTML = '';
        resultContainer.classList.add('hidden');
    }
    if (formContainer) formContainer.classList.add('hidden');
    if (loaderContainer) {
        loaderContainer.classList.remove('hidden');
        loaderContainer.classList.add('flex');
    }

    setTimeout(() => {
        if (loaderContainer) {
            loaderContainer.classList.add('hidden');
            loaderContainer.classList.remove('flex');
        }
        if (resultContainer) resultContainer.classList.remove('hidden');
        
        // Hardcoded success for happy path, but styled beautifully
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="bg-emerald-50 border border-emerald-200 rounded-[2rem] p-6 text-center w-full max-w-sm shadow-lg animate-fade-in relative overflow-hidden group">
                    <div class="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
                    <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <i data-lucide="check-circle" class="w-8 h-8"></i>
                    </div>
                    <h4 class="text-xl font-black text-emerald-900 mb-1">Transaction Successful</h4>
                    <p class="text-xs font-semibold text-emerald-700 mb-6">Payment verified with official records.</p>
                    
                    <div class="bg-white rounded-xl p-4 text-left border border-emerald-100 mb-6 shadow-sm">
                        <div class="flex justify-between py-2 border-b border-slate-50">
                            <span class="text-[10px] font-bold text-slate-400 uppercase">Candidate Name</span>
                            <span class="text-xs font-black text-slate-700">${simCandidateName || 'ABYU REDDY'}</span>
                        </div>
                        <div class="flex justify-between py-2 border-b border-slate-50">
                            <span class="text-[10px] font-bold text-slate-400 uppercase">Transaction ID</span>
                            <span class="text-xs font-black text-slate-700">${maskTransactionId("TXN984530284")}</span>
                        </div>
                        <div class="flex justify-between py-2 border-b border-slate-50">
                            <span class="text-[10px] font-bold text-slate-400 uppercase">Amount Paid</span>
                            <span class="text-xs font-black text-emerald-600">₹1,200.00</span>
                        </div>
                        <div class="flex justify-between py-2">
                            <span class="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                            <span class="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">SUCCESS</span>
                        </div>
                    </div>
                    
                    <button onclick="handleNavNavigate(7)" class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-emerald-300 flex items-center justify-center gap-2 relative z-10">
                        Proceed to Slot Booking <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
            showToast("Verified", "Transaction Found Successful", "check-circle");
        }
        if (window.lucide) window.lucide.createIcons();
    }, 2500);
}

// Deprecated old functions kept to prevent errors if referenced elsewhere (optional)
function handleSimLogin() {}
function handleSimPayment() {}
function handleSimVerify() {}

function handleSimProceedToSlotBooking() {
    showGuideScreen(7);
}

const simSlotCategoryInfo = {
    "ALL": "General category candidates can continue with ALL category slots across available HLCs.",
    "NCC": "NCC candidates should choose designated HLC/date windows where NCC verification is listed.",
    "SPORTS": "Sports category candidates should verify SG/Sports category windows before confirming slot.",
    "CAP": "CAP candidates must book a slot where CAP verification is available in special category schedule.",
    "PH": "PH candidates should choose PHC-enabled verification dates at designated HLC centers.",
    "ANGLO-INDIAN": "Anglo-Indian category candidates must choose designated category slots where available."
};

function getSimSlotCategoryMatchers(category) {
    if (category === "NCC") return ["NCC"];
    if (category === "SPORTS") return ["SPORTS", "SG"];
    if (category === "CAP") return ["CAP"];
    if (category === "PH") return ["PHC", "PH"];
    if (category === "ANGLO-INDIAN") return ["ANGLO-INDIAN", "ANG"];
    return ["OC/EWS/BC/SC/ST", "MINORITIES"];
}

function parseDdMmYyyy(dateStr) {
    const parts = (dateStr || "").split("-");
    if (parts.length !== 3) return null;
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
}

function formatDdMmYyyy(dateObj) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatSlotDateDisplay(dateStr) {
    const dt = parseDdMmYyyy(dateStr);
    if (!dt) return dateStr;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getSimSlotHlcData() {
    if (Array.isArray(hlcDataset) && hlcDataset.length > 0) {
        return hlcDataset;
    }
    return [
        {
            code: "MASB40",
            name: "GOVERNMENT POLYTECHNIC",
            place: "MASAB TANK",
            district: "HYDERABAD",
            slots: ["09:00 AM to 09:30 AM", "09:30 AM to 10:00 AM", "10:00 AM to 10:30 AM", "11:30 AM to 12:00 Noon"],
            special_categories: [{ dates: "01-07-2025 to 03-07-2025", categories: "CAP and SPORTS and OC/EWS/BC/SC/ST/MINORITIES" }]
        },
        {
            code: "JNTH06",
            name: "JNTU COLLEGE OF ENGINEERING",
            place: "KUKATPALLY",
            district: "MEDCHAL",
            slots: ["09:00 AM to 09:30 AM", "09:30 AM to 10:00 AM", "10:00 AM to 10:30 AM", "11:30 AM to 12:00 Noon"],
            special_categories: [{ dates: "01-07-2025 to 08-07-2025", categories: "NCC and PHC and ANGLO-INDIAN and OC/EWS/BC/SC/ST/MINORITIES" }]
        }
    ];
}

function initSlotBookingSection(forceReset = false) {
    const districtSelect = document.getElementById('slot-hlc-district-filter');
    const categoryPanel = document.getElementById('slot-booking-category-panel');
    const workspace = document.getElementById('slot-booking-workspace');
    const receiptPanel = document.getElementById('slot-booking-receipt-panel');
    const verificationPanel = document.getElementById('slot-verification-guidance');
    const confirmModal = document.getElementById('slot-confirm-modal');

    const ticketInput = document.getElementById('sim-slot-login-ticket');
    const regInput = document.getElementById('sim-slot-login-reg');
    const dobInput = document.getElementById('sim-slot-login-dob');
    const captchaInput = document.getElementById('sim-slot-login-captcha');
    if (ticketInput) ticketInput.value = simHallTicket;
    if (regInput && !regInput.value) regInput.value = maskRegistrationNo("220004");
    if (dobInput && !dobInput.value) dobInput.value = "2006-08-15";
    if (captchaInput && forceReset) captchaInput.value = "";

    if (forceReset) {
        simSlotBookingState = {
            loggedIn: false,
            selectedCategory: "ALL",
            selectedHlcCode: "",
            selectedDate: "",
            selectedSlot: "",
            receipt: null
        };
    }

    if (categoryPanel) categoryPanel.classList.toggle('hidden', !simSlotBookingState.loggedIn);
    if (workspace) workspace.classList.toggle('hidden', !simSlotBookingState.loggedIn);
    if (receiptPanel && (!simSlotBookingState.receipt || forceReset)) receiptPanel.classList.add('hidden');
    if (verificationPanel && (!simSlotBookingState.receipt || forceReset)) verificationPanel.classList.add('hidden');
    if (confirmModal) confirmModal.classList.add('hidden');

    if (districtSelect) {
        const previousValue = districtSelect.value || "ALL";
        const districts = [...new Set(getSimSlotHlcData().map(h => h.district).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        districtSelect.innerHTML = '<option value="ALL">All Districts</option>';
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.innerText = d;
            districtSelect.appendChild(opt);
        });
        districtSelect.value = districts.includes(previousValue) ? previousValue : "ALL";
    }

    updateSimSlotCategoryButtons();
    renderSimSlotHlcList();
}

function handleSimSlotLoginAndShow() {
    const ticket = document.getElementById('sim-slot-login-ticket')?.value.trim();
    const reg = document.getElementById('sim-slot-login-reg')?.value.trim();
    const dob = document.getElementById('sim-slot-login-dob')?.value.trim();
    const captcha = document.getElementById('sim-slot-login-captcha')?.value.trim();

    if (!ticket || !reg || !dob || !captcha) {
        showToast("Missing Fields", "Please enter all login fields to view available slots.", "alert-triangle");
        return;
    }
    if (captcha !== "8246") {
        showToast("Invalid Captcha", "Captcha mismatch. Type 8246 and try again.", "alert-triangle");
        return;
    }

    simHallTicket = ticket;
    simDetailsSet = true;
    updateDOMCandidateDetails();
    simSlotBookingState.loggedIn = true;

    document.getElementById('slot-booking-category-panel')?.classList.remove('hidden');
    document.getElementById('slot-booking-workspace')?.classList.remove('hidden');
    renderSimSlotHlcList();

    showToast("Login Verified", "Slot booking schedule loaded successfully.", "check-circle");
}

function setSimSlotCategory(category) {
    simSlotBookingState.selectedCategory = category;
    simSlotBookingState.selectedDate = "";
    simSlotBookingState.selectedSlot = "";
    updateSimSlotCategoryButtons();
    renderSimSlotHlcList();
}

function updateSimSlotCategoryButtons() {
    const current = simSlotBookingState.selectedCategory || "ALL";
    document.querySelectorAll('.slot-category-btn').forEach(btn => {
        const cat = btn.getAttribute('data-slot-category');
        if (cat === current) {
            btn.className = "slot-category-btn px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-black transition-all";
        } else {
            btn.className = "slot-category-btn px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-black transition-all hover:bg-slate-50";
        }
    });

    const desc = document.getElementById('slot-category-desc');
    if (desc) desc.innerText = simSlotCategoryInfo[current] || simSlotCategoryInfo.ALL;
}

function hlcSupportsCategory(hlc, category) {
    const entries = Array.isArray(hlc?.special_categories) ? hlc.special_categories : [];
    const matchers = getSimSlotCategoryMatchers(category);
    if (entries.length === 0) return category === "ALL";
    return entries.some(entry => {
        const text = (entry.categories || "").toUpperCase();
        return matchers.some(token => text.includes(token));
    });
}

function getHlcDateSetForCategory(hlc, category) {
    const entries = Array.isArray(hlc?.special_categories) ? hlc.special_categories : [];
    const matchers = getSimSlotCategoryMatchers(category);
    const allowedEntries = entries.filter(entry => {
        const text = (entry.categories || "").toUpperCase();
        return matchers.some(token => text.includes(token));
    });

    const sourceEntries = allowedEntries.length > 0 ? allowedEntries : (category === "ALL" ? entries : []);
    const dateSet = new Set();

    sourceEntries.forEach(entry => {
        const range = entry.dates || "";
        if (range.includes("to")) {
            const [startRaw, endRaw] = range.split("to").map(v => v.trim());
            const start = parseDdMmYyyy(startRaw);
            const end = parseDdMmYyyy(endRaw);
            if (start && end) {
                const cursor = new Date(start);
                while (cursor <= end) {
                    dateSet.add(formatDdMmYyyy(cursor));
                    cursor.setDate(cursor.getDate() + 1);
                }
            }
        } else {
            const single = parseDdMmYyyy(range.trim());
            if (single) dateSet.add(formatDdMmYyyy(single));
        }
    });

    return dateSet;
}

function renderSimSlotHlcList() {
    const container = document.getElementById('slot-hlc-results');
    if (!container) return;

    const search = (document.getElementById('slot-hlc-search')?.value || "").trim().toUpperCase();
    const district = document.getElementById('slot-hlc-district-filter')?.value || "ALL";
    const category = simSlotBookingState.selectedCategory || "ALL";

    const records = getSimSlotHlcData().filter(hlc => {
        if (district !== "ALL" && hlc.district !== district) return false;
        if (!search) return true;
        const hay = `${hlc.name} ${hlc.place} ${hlc.district}`.toUpperCase();
        return hay.includes(search);
    });

    if (records.length === 0) {
        container.innerHTML = '<div class="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">No HLC matched your search. Try a different district or keyword.</div>';
        renderSimSlotCalendar();
        return;
    }

    container.innerHTML = "";
    records.forEach(hlc => {
        const supports = hlcSupportsCategory(hlc, category);
        const isSelected = simSlotBookingState.selectedHlcCode === hlc.code;
        const capacityLabel = !supports ? "Not Eligible" : (Array.isArray(hlc.slots) && hlc.slots.length >= 12 ? "Open Slots" : "Limited Slots");

        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = `w-full text-left p-4 rounded-2xl border transition-all ${isSelected ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'} ${supports ? '' : 'opacity-70'}`;
        btn.innerHTML = `
            <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p class="text-xs font-black text-slate-800">${hlc.name}</p>
                    <p class="text-[11px] text-slate-500 font-semibold mt-1">${hlc.place}, ${hlc.district}</p>
                </div>
                <span class="text-[10px] px-2.5 py-1 rounded-full font-black ${supports ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}">${capacityLabel}</span>
            </div>
            <div class="flex flex-wrap gap-2 mt-3 text-[10px] font-bold">
                <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">${(hlc.slots || []).length || 16} slots/day</span>
                <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">${hlc.code || 'HLC'}</span>
            </div>
        `;
        btn.addEventListener('click', () => {
            if (!supports) {
                showToast("Category Restriction", `Selected category schedule is not available at ${hlc.name}.`, "alert-triangle");
                return;
            }
            simSlotBookingState.selectedHlcCode = hlc.code;
            simSlotBookingState.selectedDate = "";
            simSlotBookingState.selectedSlot = "";
            renderSimSlotHlcList();
            renderSimSlotCalendar();
            renderSimSlotTimes();
        });
        container.appendChild(btn);
    });

    const selected = records.find(r => r.code === simSlotBookingState.selectedHlcCode);
    if (!selected && records.length > 0) {
        const firstSupported = records.find(r => hlcSupportsCategory(r, category));
        if (firstSupported) {
            simSlotBookingState.selectedHlcCode = firstSupported.code;
            renderSimSlotHlcList();
            return;
        } else {
            simSlotBookingState.selectedHlcCode = "";
        }
    }

    renderSimSlotCalendar();
    renderSimSlotTimes();
}

function renderSimSlotCalendar() {
    const selectedMeta = document.getElementById('slot-selected-hlc-meta');
    const calendarGrid = document.getElementById('slot-calendar-grid');
    const calendarState = document.getElementById('slot-calendar-state');
    if (!selectedMeta || !calendarGrid || !calendarState) return;

    const hlc = getSimSlotHlcData().find(h => h.code === simSlotBookingState.selectedHlcCode);
    if (!hlc) {
        selectedMeta.innerText = "Choose an HLC card to view schedule.";
        calendarGrid.innerHTML = "";
        calendarState.innerText = "Select HLC to load available dates.";
        return;
    }

    selectedMeta.innerText = `${hlc.name}, ${hlc.place}, ${hlc.district}`;
    const dateSet = getHlcDateSetForCategory(hlc, simSlotBookingState.selectedCategory);
    const availableDates = Array.from(dateSet).sort((a, b) => (parseDdMmYyyy(a) || 0) - (parseDdMmYyyy(b) || 0));

    if (availableDates.length === 0) {
        calendarGrid.innerHTML = "";
        calendarState.innerText = "No date window found for selected category at this HLC.";
        simSlotBookingState.selectedDate = "";
        return;
    }

    const start = parseDdMmYyyy(availableDates[0]);
    const cells = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = formatDdMmYyyy(d);
        const isAllowed = dateSet.has(key);
        let state = "disabled";
        if (isAllowed) state = (i % 5 === 0 ? "full" : "available");
        cells.push({ key, label: formatSlotDateDisplay(key), state });
    }

    if (simSlotBookingState.selectedDate) {
        const selectedCell = cells.find(c => c.key === simSlotBookingState.selectedDate && c.state === "available");
        if (!selectedCell) simSlotBookingState.selectedDate = "";
    }

    calendarGrid.innerHTML = "";
    cells.forEach(cell => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.title = cell.state === "available" ? "Available for booking" : (cell.state === "full" ? "Full - choose another date" : "Unavailable for selected category");
        const selectedClass = simSlotBookingState.selectedDate === cell.key ? "ring-2 ring-indigo-500" : "";
        if (cell.state === "available") {
            btn.className = `p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-black text-center transition-all hover:bg-emerald-100 ${selectedClass}`;
            btn.addEventListener('click', () => {
                simSlotBookingState.selectedDate = cell.key;
                simSlotBookingState.selectedSlot = "";
                renderSimSlotCalendar();
                renderSimSlotTimes();
            });
        } else if (cell.state === "full") {
            btn.className = "p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-[11px] font-black text-center cursor-not-allowed";
            btn.disabled = true;
        } else {
            btn.className = "p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 text-[11px] font-black text-center cursor-not-allowed";
            btn.disabled = true;
        }
        btn.innerText = cell.label;
        calendarGrid.appendChild(btn);
    });

    calendarState.innerText = simSlotBookingState.selectedDate
        ? `Selected date: ${formatSlotDateDisplay(simSlotBookingState.selectedDate)}`
        : "Choose a green date to continue.";
}

function renderSimSlotTimes() {
    const timeGrid = document.getElementById('slot-time-grid');
    const timeState = document.getElementById('slot-time-state');
    if (!timeGrid || !timeState) return;

    const hlc = getSimSlotHlcData().find(h => h.code === simSlotBookingState.selectedHlcCode);
    if (!hlc) {
        timeGrid.innerHTML = "";
        timeState.innerText = "Select HLC to view time slots.";
        return;
    }
    if (!simSlotBookingState.selectedDate) {
        timeGrid.innerHTML = "";
        timeState.innerText = "Select date to view slot availability.";
        return;
    }

    const slots = Array.isArray(hlc.slots) && hlc.slots.length ? hlc.slots : [
        "09:00 AM to 09:30 AM", "09:30 AM to 10:00 AM", "10:00 AM to 10:30 AM"
    ];

    const seed = simSlotBookingState.selectedDate.split("-").join("");
    const seedNum = Number(seed) || 0;
    timeGrid.innerHTML = "";
    let availableCount = 0;

    slots.forEach((slot, idx) => {
        const score = (seedNum + idx * 7) % 11;
        const state = score <= 1 ? "full" : (score <= 4 ? "filling" : "available");
        const selected = simSlotBookingState.selectedSlot === slot;
        if (state !== "full") availableCount++;

        const btn = document.createElement('button');
        btn.type = "button";

        if (state === "full") {
            btn.className = "p-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-[11px] font-black text-left cursor-not-allowed";
            btn.disabled = true;
        } else if (state === "filling") {
            btn.className = `p-3 rounded-xl border text-[11px] font-black text-left transition-all ${selected ? 'border-amber-400 bg-amber-100 ring-2 ring-amber-300' : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'}`;
            btn.addEventListener('click', () => {
                simSlotBookingState.selectedSlot = slot;
                renderSimSlotTimes();
            });
        } else {
            btn.className = `p-3 rounded-xl border text-[11px] font-black text-left transition-all ${selected ? 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300' : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'}`;
            btn.addEventListener('click', () => {
                simSlotBookingState.selectedSlot = slot;
                renderSimSlotTimes();
            });
        }

        const label = state === "full" ? "Full" : (state === "filling" ? "Filling Fast" : "Available");
        btn.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <span>${slot}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full border ${state === 'full' ? 'bg-white text-slate-500 border-slate-300' : state === 'filling' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}">${label}</span>
            </div>
        `;
        timeGrid.appendChild(btn);
    });

    timeState.innerText = simSlotBookingState.selectedSlot
        ? `Selected slot: ${simSlotBookingState.selectedSlot}`
        : `${availableCount} slots are currently selectable for ${formatSlotDateDisplay(simSlotBookingState.selectedDate)}.`;
}

function handleSimBookSlot() {
    if (!simSlotBookingState.loggedIn) {
        showToast("Login Required", "Please complete candidate login before booking slot.", "alert-triangle");
        return;
    }
    if (!simSlotBookingState.selectedHlcCode || !simSlotBookingState.selectedDate || !simSlotBookingState.selectedSlot) {
        showToast("Complete Selection", "Please choose HLC, date, and time slot before confirmation.", "alert-triangle");
        return;
    }

    const hlc = getSimSlotHlcData().find(h => h.code === simSlotBookingState.selectedHlcCode);
    if (!hlc) return;

    const confirmModal = document.getElementById('slot-confirm-modal');
    if (confirmModal) confirmModal.classList.remove('hidden');
    document.getElementById('slot-confirm-hlc').innerText = `${hlc.name}, ${hlc.place}`;
    document.getElementById('slot-confirm-date').innerText = formatSlotDateDisplay(simSlotBookingState.selectedDate);
    document.getElementById('slot-confirm-time').innerText = simSlotBookingState.selectedSlot;
    document.getElementById('slot-confirm-category').innerText = simSlotBookingState.selectedCategory;
}

function closeSimSlotConfirmation() {
    document.getElementById('slot-confirm-modal')?.classList.add('hidden');
}

function confirmSimSlotBooking() {
    const hlc = getSimSlotHlcData().find(h => h.code === simSlotBookingState.selectedHlcCode);
    if (!hlc) return;

    closeSimSlotConfirmation();

    const serial = `TGSLOT-2026-${Date.now().toString().slice(-6)}`;
    simSlotBookingState.receipt = {
        serial,
        candidateName: maskName(simCandidateName || "Student Demo"),
        fatherName: maskName("Parent Demo"),
        hallTicket: maskHallTicket(simHallTicket || "2505XXXX92"),
        rank: simRank || 6917,
        hlcName: hlc.name,
        hlcAddress: `${hlc.place}, ${hlc.district}`,
        date: simSlotBookingState.selectedDate,
        time: simSlotBookingState.selectedSlot,
        category: simSlotBookingState.selectedCategory
    };

    document.getElementById('slot-receipt-serial').innerText = simSlotBookingState.receipt.serial;
    document.getElementById('slot-receipt-name').innerText = simSlotBookingState.receipt.candidateName;
    document.getElementById('slot-receipt-father').innerText = simSlotBookingState.receipt.fatherName;
    document.getElementById('slot-receipt-ticket').innerText = simSlotBookingState.receipt.hallTicket;
    document.getElementById('slot-receipt-rank').innerText = simSlotBookingState.receipt.rank;
    document.getElementById('slot-receipt-hlc').innerText = simSlotBookingState.receipt.hlcName;
    document.getElementById('slot-receipt-address').innerText = simSlotBookingState.receipt.hlcAddress;
    document.getElementById('slot-receipt-date').innerText = formatSlotDateDisplay(simSlotBookingState.receipt.date);
    document.getElementById('slot-receipt-time').innerText = simSlotBookingState.receipt.time;
    document.getElementById('slot-receipt-category').innerText = simSlotBookingState.receipt.category;

    const smsMessage = document.getElementById('slot-sms-message');
    if (smsMessage) {
        smsMessage.innerText = `Your slot booking has been confirmed successfully. HLC: ${hlc.name}, Time: ${simSlotBookingState.receipt.time} on ${formatSlotDateDisplay(simSlotBookingState.receipt.date)}. Please report 10 minutes early.`;
    }

    document.getElementById('slot-booking-receipt-panel')?.classList.remove('hidden');
    document.getElementById('slot-sms-card')?.classList.remove('hidden');
    document.getElementById('slot-verification-guidance')?.classList.remove('hidden');

    // Populate screen 9 details to preserve sequence continuity.
    const verifiedHlc = document.getElementById('sim-verified-hlc');
    if (verifiedHlc) verifiedHlc.innerText = `${hlc.name}, ${hlc.place}`;
    const verifiedDate = document.getElementById('sim-verified-date');
    if (verifiedDate) verifiedDate.innerText = simSlotBookingState.receipt.date;
    const verifiedTime = document.getElementById('sim-verified-time');
    if (verifiedTime) verifiedTime.innerText = simSlotBookingState.receipt.time;

    showToast("Slot Confirmed", `Verification slot booked at ${hlc.name}.`, "check-circle");
}

function printSimSlotReceipt() {
    if (!simSlotBookingState.receipt) {
        showToast("No Receipt", "Please confirm slot booking before printing receipt.", "alert-triangle");
        return;
    }

    const r = simSlotBookingState.receipt;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast("Popup Blocked", "Enable pop-up windows to print slot booking receipt.", "alert-triangle");
        return;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET Slot Booking Receipt</title>
            <style>
                body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
                .sheet { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 22px; }
                h1 { font-size: 20px; margin: 0 0 8px; }
                .muted { color: #475569; font-size: 12px; margin-bottom: 16px; }
                .row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e2e8f0; padding: 8px 0; font-size: 13px; }
                .k { color: #475569; font-weight: 700; }
                .v { font-weight: 700; text-align: right; }
                .note { margin-top: 14px; padding: 10px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 12px; font-weight: 700; }
            </style>
        </head>
        <body>
            <div class="sheet">
                <h1>TG EAPCET 2026 - Slot Booking Receipt</h1>
                <p class="muted">Certificate Verification Appointment Slip</p>
                <div class="row"><span class="k">Serial Number</span><span class="v">${r.serial}</span></div>
                <div class="row"><span class="k">Candidate Name</span><span class="v">${r.candidateName}</span></div>
                <div class="row"><span class="k">Father Name</span><span class="v">${r.fatherName}</span></div>
                <div class="row"><span class="k">Hall Ticket Number</span><span class="v">${r.hallTicket}</span></div>
                <div class="row"><span class="k">Rank</span><span class="v">${r.rank}</span></div>
                <div class="row"><span class="k">HLC Name</span><span class="v">${r.hlcName}</span></div>
                <div class="row"><span class="k">HLC Address</span><span class="v">${r.hlcAddress}</span></div>
                <div class="row"><span class="k">Slot Date</span><span class="v">${formatSlotDateDisplay(r.date)}</span></div>
                <div class="row"><span class="k">Slot Time</span><span class="v">${r.time}</span></div>
                <div class="row"><span class="k">Slot Category</span><span class="v">${r.category}</span></div>
                <div class="note">Candidate should report 10 minutes before slot timing.</div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function handleSimComplete() {
    showToast("Simulation Completed", "Congratulations! You have completed the Counselling simulation guide.", "check-circle");
    showView('home');
}

function populateSimHlcs() {
    renderSimSlotHlcList();
}

function triggerSmsAlert() {
    const mockNotification = document.getElementById('sms-notification-mock');
    const smsBtn = document.getElementById('proceed-sms-btn');
    const pwdBtn = document.getElementById('proceed-pwd-btn');
    
    if (mockNotification) {
        mockNotification.classList.remove('hidden');
        setTimeout(() => {
            mockNotification.style.transform = 'translateY(80px)';
        }, 50);
    }
    
    if (smsBtn) smsBtn.classList.add('hidden');
    if (pwdBtn) pwdBtn.classList.remove('hidden');
    
    showToast("SMS Delivered", `Login ID: ${maskLoginId("TGE2489543")} has been sent to registered mobile!`, "message-square");
}

function checkPwdStrength(val) {
    const label = document.getElementById('pwd-strength-label');
    const bar = document.getElementById('pwd-strength-bar');
    if (!label || !bar) return;

    if (val.length < 6) {
        label.innerText = "Too Short";
        bar.className = "h-full bg-rose-500 transition-all duration-300";
        bar.style.width = "20%";
    } else if (val.length >= 8 && /[A-Z]/.test(val) && /[!@#$%^&*(),.?":{}|<>]/.test(val)) {
        label.innerText = "Strong";
        bar.className = "h-full bg-emerald-500 transition-all duration-300";
        bar.style.width = "100%";
    } else {
        label.innerText = "Medium";
        bar.className = "h-full bg-amber-500 transition-all duration-300";
        bar.style.width = "60%";
    }
}

function handleSimPwdGenerate() {
    const reg = document.getElementById('sim-pwd-reg')?.value.trim();
    const ht = document.getElementById('sim-pwd-ticket')?.value.trim();
    const rank = document.getElementById('sim-pwd-rank')?.value.trim();

    if (!reg || !ht || !rank) {
        showToast("Missing Fields", "Please complete all verification fields.", "alert-triangle");
        return;
    }

    showToast("Authenticated", "Credentials verified! Setup your portal password.", "check-circle");
    showGuideScreen("10-set");
}

function handleSimPwdSave() {
    const pwd1 = document.getElementById('sim-new-pwd')?.value;
    const pwd2 = document.getElementById('sim-confirm-pwd')?.value;

    if (!pwd1 || pwd1.length < 6) {
        showToast("Invalid Password", "Password must be at least 6 characters long.", "alert-triangle");
        return;
    }
    if (pwd1 !== pwd2) {
        showToast("Mismatch", "Passwords do not match!", "alert-triangle");
        return;
    }

    simPassword = pwd1;
    showToast("Password Saved", "Portal credentials recorded! Proceeding to Candidate Sign In.", "check-circle");
    showGuideScreen(11);
}

function handleSimPortalLogin() {
    const loginId = document.getElementById('sim-portal-login-id')?.value.trim();
    const ht = document.getElementById('sim-portal-ticket')?.value.trim();
    const pwd = document.getElementById('sim-portal-pwd')?.value;
    const captcha = document.getElementById('sim-portal-captcha')?.value.trim();

    if (!loginId || !ht || !pwd || !captcha) {
        showToast("Missing Fields", "Please fill in all portal login credentials.", "alert-triangle");
        return;
    }

    if (captcha.toUpperCase() !== "LOGIN") {
        showToast("Invalid Captcha", "The security verification captcha is incorrect.", "alert-triangle");
        return;
    }

    if (pwd !== simPassword) {
        showToast("Access Denied", "Incorrect portal password. Please try again.", "alert-triangle");
        return;
    }

    showToast("Logged In", "Secure login authenticated. Verify OTP to authorize session.", "check-circle");
    showGuideScreen(12);
    startOtpCountdown();
}

function startOtpCountdown() {
    let timeLeft = 120;
    const timerLabel = document.getElementById('sim-otp-timer');
    if (!timerLabel) return;

    if (simOtpTimerInterval) clearInterval(simOtpTimerInterval);

    simOtpTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(simOtpTimerInterval);
            timerLabel.innerText = "OTP Expired";
        } else {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerLabel.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} remaining`;
        }
    }, 1000);
}

function resendSimOtp() {
    showToast("OTP Sent", "A new 6-digit OTP code has been dispatched.", "message-square");
    startOtpCountdown();
}

function handleSimOtpSubmit() {
    const check = document.getElementById('sim-declaration-check');
    if (!check || !check.checked) {
        showToast("Declaration Required", "Please check the declaration box before proceeding.", "alert-triangle");
        return;
    }

    if (simOtpTimerInterval) clearInterval(simOtpTimerInterval);
    showToast("Authorized", "Verification successful. Loading Option Entry workspace.", "check-circle");
    showGuideScreen(13);
}

function initSimFilters() {
    const distContainer = document.getElementById('sim-district-checkboxes');
    if (!distContainer) return;

    distContainer.innerHTML = "";

    const districts = [...new Set(collegesDataset.map(c => c.district).filter(Boolean))].sort();

    // Render districts checklist
    districts.forEach(d => {
        const active = simSelectedDistricts.has(d);
        const div = document.createElement('div');
        div.className = "flex items-center gap-2";
        div.innerHTML = `
            <label class="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-200/50 w-full transition-all select-none">
                <input type="checkbox" value="${d}" ${active ? 'checked' : ''} 
                    onchange="toggleSimDistrict('${d}', this.checked)"
                    class="rounded text-purple-600 focus:ring-purple-400 w-4 h-4 border-slate-300">
                <span class="text-xs font-bold text-slate-700">${d}</span>
            </label>
        `;
        distContainer.appendChild(div);
    });

    updateFilteredPreview();
}

function toggleSimDistrict(d, checked) {
    if (checked) simSelectedDistricts.add(d);
    else simSelectedDistricts.delete(d);
    updateFilteredPreview();
}

function selectAllSimDistricts(val) {
    const checkboxes = document.querySelectorAll('#sim-district-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = val;
        if (val) simSelectedDistricts.add(cb.value);
        else simSelectedDistricts.delete(cb.value);
    });
    updateFilteredPreview();
}

function updateFilteredPreview() {
    let matchesCount = 0;
    const selectedDistrictsArray = [...simSelectedDistricts];

    collegesDataset.forEach(c => {
        if (selectedDistrictsArray.length > 0 && !simSelectedDistricts.has(c.district)) return;
        matchesCount++;
    });

    const countLabel = document.getElementById('sim-filter-count');
    if (countLabel) {
        countLabel.innerText = `Matching Colleges: ${matchesCount}`;
    }
}

function handleSimFilteringSubmit() {
    // Automatically select all branch codes from the dataset to display them as columns in Screen 15
    simSelectedBranches.clear();
    const branches = [...new Set(branchesDataset.map(b => b.code).filter(Boolean))].sort();
    branches.forEach(b => simSelectedBranches.add(b));

    showGuideScreen(15);
}

function renderSimWorkspace() {
    const table = document.getElementById('sim-option-entry-table');
    if (!table) return;
    table.innerHTML = "";

    const selectedDistrictsArray = [...simSelectedDistricts];
    const selectedBranchesArray = [...simSelectedBranches].sort();

    if (selectedDistrictsArray.length === 0 && selectedBranchesArray.length === 0) {
        table.innerHTML = `<tr><td class="p-6 text-center text-slate-400 font-bold text-xs">Please select at least one district and course branch first.</td></tr>`;
        return;
    }

    // Header Row
    let headHtml = `
        <thead>
            <tr class="bg-slate-100 border-b border-slate-200 sticky top-0 z-20 text-[10px] uppercase tracking-wider text-slate-500">
                <th class="py-3.5 px-3 border-r border-slate-200 text-center font-black sticky-col-sno" style="width: 50px;">S.No</th>
                <th class="py-3.5 px-3 border-r border-slate-200 font-black text-center sticky-col-code" style="width: 80px;">College Code</th>
                <th class="py-3.5 px-3 border-r border-slate-200 font-black text-left sticky-col-name">College Name</th>
                <th class="py-3.5 px-3 border-r border-slate-200 text-center font-black" style="width: 65px;">Dist</th>
                <th class="py-3.5 px-3 border-r border-slate-200 text-center font-black" style="width: 70px;">Type</th>
    `;
    
    selectedBranchesArray.forEach(bCode => {
        headHtml += `<th class="py-3.5 px-3 text-center border-r border-slate-200 font-black text-[10px] bg-slate-50" style="min-width: 60px;">${bCode}</th>`;
    });
    headHtml += `</tr></thead>`;

    // Filter matching colleges
    const matchedColleges = collegesDataset.filter(c => {
        if (selectedDistrictsArray.length > 0 && !simSelectedDistricts.has(c.district)) return false;
        // Check if offers at least one selected branch
        const offersAtLeastOne = Object.keys(c.branches).some(bCode => simSelectedBranches.has(bCode));
        return offersAtLeastOne;
    });

    if (matchedColleges.length === 0) {
        table.innerHTML = `<tr><td class="p-6 text-center text-slate-400 font-bold text-xs">No matching colleges found for selected criteria.</td></tr>`;
        return;
    }

    let bodyHtml = `<tbody>`;
    matchedColleges.forEach((c, idx) => {
        const type = getInstitutionType(c);
        let typeBg = "bg-yellow-50/20 hover:bg-yellow-100/40"; 
        let borderStyle = "border-l-4 border-l-yellow-400";
        if (type === "GOV") {
            typeBg = "bg-blue-50/20 hover:bg-blue-100/40";
            borderStyle = "border-l-4 border-l-blue-500";
        } else if (type === "Self-Finance") {
            typeBg = "bg-slate-50 hover:bg-slate-100/70";
            borderStyle = "border-l-4 border-l-slate-400";
        } else if (type === "Girls") {
            typeBg = "bg-pink-50/20 hover:bg-pink-100/40";
            borderStyle = "border-l-4 border-l-pink-400";
        } else if (type === "Minority") {
            typeBg = "bg-emerald-50/20 hover:bg-emerald-100/40";
            borderStyle = "border-l-4 border-l-emerald-500";
        }

        bodyHtml += `<tr class="border-b border-slate-200 ${typeBg} transition-colors">`;
        bodyHtml += `<td class="py-3 px-3 border-r border-slate-200 text-center font-bold text-[10px] ${borderStyle} sticky-col-sno">${idx + 1}</td>`;
        bodyHtml += `<td class="py-3 px-3 border-r border-slate-200 font-mono text-[11px] font-black text-slate-900 bg-slate-100/30 text-center sticky-col-code">${c.inst_code}</td>`;
        bodyHtml += `<td class="py-3 px-3 border-r border-slate-200 font-bold text-slate-800 text-[11px] truncate max-w-[220px] sticky-col-name" title="${c.name}">${c.name}</td>`;
        bodyHtml += `<td class="py-3 px-3 border-r border-slate-200 font-bold text-slate-600 text-[10px] text-center">${c.district}</td>`;
        bodyHtml += `<td class="py-3 px-3 border-r border-slate-200 font-bold text-[10px] text-center">${type}</td>`;

        selectedBranchesArray.forEach(bCode => {
            const offers = c.branches[bCode];
            if (offers) {
                const existing = simSavedOptions.find(o => o.collegeCode === c.inst_code && o.branch === bCode);
                const priorityVal = existing ? existing.priority : "";

                bodyHtml += `<td class="p-1.5 border-r border-slate-200 text-center">
                    <input type="number" min="1" value="${priorityVal}" placeholder=""
                        onchange="updateSimOptionValue('${c.inst_code}', '${bCode}', this.value)"
                        class="w-11 p-1 bg-white border border-slate-300 rounded font-black text-center text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none transition-all">
                </td>`;
            } else {
                bodyHtml += `<td class="p-1.5 border-r border-slate-200 bg-slate-200/50"></td>`;
            }
        });
        bodyHtml += `</tr>`;
    });
    bodyHtml += `</tbody>`;

    table.innerHTML = headHtml + bodyHtml;

    updateSimWorkspaceLockedCount();
    checkSimDuplicates();
}

function getInstitutionType(c) {
    const name = c.name.toLowerCase();
    if (name.includes("university college") || name.includes("jntu") || name.includes("osmania")) return "GOV";
    if (name.includes("women") || name.includes("girls")) return "Girls";
    if (name.includes("minority") || name.includes("muffakham")) return "Minority";
    if (name.includes("autonomous") || name.includes("self-finance")) return "Self-Finance";
    return "Private";
}

function updateSimOptionValue(collegeCode, branchCode, valueStr) {
    const val = parseInt(valueStr);
    const indicator = document.getElementById('sim-autosave-indicator');
    if (indicator) {
        indicator.innerText = "Saving changes...";
    }

    if (isNaN(val) || val < 1) {
        simSavedOptions = simSavedOptions.filter(o => !(o.collegeCode === collegeCode && o.branch === branchCode));
    } else {
        const college = collegesDataset.find(col => col.inst_code === collegeCode);
        const existingIndex = simSavedOptions.findIndex(o => o.collegeCode === collegeCode && o.branch === branchCode);

        const optionItem = {
            priority: val,
            collegeCode: collegeCode,
            collegeName: college ? college.name : collegeCode,
            branch: branchCode,
            district: college ? college.district : "",
            type: college ? getInstitutionType(college) : "Private"
        };

        if (existingIndex > -1) {
            simSavedOptions[existingIndex] = optionItem;
        } else {
            simSavedOptions.push(optionItem);
        }
    }

    simSavedOptions.sort((a, b) => a.priority - b.priority);

    setTimeout(() => {
        if (indicator) {
            indicator.innerText = "All changes saved";
        }
        updateSimWorkspaceLockedCount();
        checkSimDuplicates();
    }, 400);
}

function openSimInsertBetweenModal() {
    const modal = document.getElementById('sim-insert-between-modal');
    const collegeSelect = document.getElementById('sim-insert-college');
    if (!modal || !collegeSelect) return;

    collegeSelect.innerHTML = "";

    const selectedDistrictsArray = [...simSelectedDistricts];
    const uniqueColleges = collegesDataset.filter(c => {
        if (selectedDistrictsArray.length > 0 && !simSelectedDistricts.has(c.district)) return false;
        return Object.keys(c.branches).some(bCode => simSelectedBranches.has(bCode));
    }).sort((a, b) => a.inst_code.localeCompare(b.inst_code));

    uniqueColleges.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.inst_code;
        opt.innerText = `${c.inst_code} - ${c.name.slice(0, 45)}...`;
        collegeSelect.appendChild(opt);
    });

    populateInsertBranches();
    modal.classList.remove('hidden');
}

function closeSimInsertBetweenModal() {
    const modal = document.getElementById('sim-insert-between-modal');
    if (modal) modal.classList.add('hidden');
}

function populateInsertBranches() {
    const collegeCode = document.getElementById('sim-insert-college').value;
    const branchSelect = document.getElementById('sim-insert-branch');
    if (!branchSelect) return;
    branchSelect.innerHTML = "";

    const college = collegesDataset.find(c => c.inst_code === collegeCode);
    if (!college) return;

    Object.keys(college.branches).forEach(bCode => {
        if (simSelectedBranches.size > 0 && !simSelectedBranches.has(bCode)) return;
        const opt = document.createElement('option');
        opt.value = bCode;
        opt.innerText = bCode;
        branchSelect.appendChild(opt);
    });
}

function handleSimInsertBetweenSubmit() {
    const insertPos = parseInt(document.getElementById('sim-insert-pos')?.value);
    const collegeCode = document.getElementById('sim-insert-college')?.value;
    const branchCode = document.getElementById('sim-insert-branch')?.value;

    if (isNaN(insertPos) || insertPos < 1) {
        showToast("Invalid Priority", "Please enter a valid option number to insert at.", "alert-triangle");
        return;
    }
    if (!collegeCode || !branchCode) {
        showToast("Selection Needed", "Please select both a college and branch.", "alert-triangle");
        return;
    }

    // Shift all options starting from insertPos down by 1
    simSavedOptions.forEach(o => {
        if (o.priority >= insertPos) {
            o.priority += 1;
        }
    });

    const college = collegesDataset.find(c => c.inst_code === collegeCode);
    const existingIndex = simSavedOptions.findIndex(o => o.collegeCode === collegeCode && o.branch === branchCode);

    const optionItem = {
        priority: insertPos,
        collegeCode: collegeCode,
        collegeName: college ? college.name : collegeCode,
        branch: branchCode,
        district: college ? college.district : "",
        type: college ? getInstitutionType(college) : "Private"
    };

    if (existingIndex > -1) {
        simSavedOptions[existingIndex] = optionItem;
    } else {
        simSavedOptions.push(optionItem);
    }

    simSavedOptions.sort((a, b) => a.priority - b.priority);

    closeSimInsertBetweenModal();
    renderSimWorkspace();
    showToast("Option Inserted", `Inserted option at priority ${insertPos} and shifted others down.`, "check-circle");
}

function updateSimWorkspaceLockedCount() {
    const countEl = document.getElementById('sim-locked-choices-count');
    if (countEl) countEl.innerText = simSavedOptions.length;
}

function checkSimDuplicates() {
    const warningEl = document.getElementById('sim-duplicate-warning-text');
    const inputs = document.querySelectorAll('#sim-option-entry-table input[type="number"]');
    
    const priorityCounts = {};
    inputs.forEach(input => {
        const val = input.value.trim();
        if (val) {
            priorityCounts[val] = (priorityCounts[val] || 0) + 1;
        }
    });

    let hasDuplicates = false;
    inputs.forEach(input => {
        const val = input.value.trim();
        if (val && priorityCounts[val] > 1) {
            input.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-700', 'ring-2', 'ring-rose-200');
            hasDuplicates = true;
        } else {
            input.classList.remove('border-rose-500', 'bg-rose-50', 'text-rose-700', 'ring-2', 'ring-rose-200');
        }
    });

    if (warningEl) {
        if (hasDuplicates) {
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
    }
}

function openSimViewOptionsModal() {
    const modal = document.getElementById('sim-view-options-modal');
    const container = document.getElementById('sim-modal-options-list');
    if (!modal || !container) return;

    container.innerHTML = "";
    if (simSavedOptions.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 font-bold text-xs">No options selected yet.</div>`;
    } else {
        simSavedOptions.forEach(o => {
            const item = document.createElement('div');
            item.className = "flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold mb-2";
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">${o.priority}</span>
                    <div>
                        <span class="block text-slate-800 font-bold">${o.collegeCode} - ${o.branch}</span>
                        <span class="text-[9px] text-slate-400 block">${o.collegeName}</span>
                    </div>
                </div>
                <button onclick="removeSimOption('${o.collegeCode}', '${o.branch}')" class="text-rose-600 hover:text-rose-700 font-bold text-xs">Delete</button>
            `;
            container.appendChild(item);
        });
    }

    modal.classList.remove('hidden');
}

function closeSimViewOptionsModal() {
    const modal = document.getElementById('sim-view-options-modal');
    if (modal) modal.classList.add('hidden');
}

function removeSimOption(collegeCode, branch) {
    simSavedOptions = simSavedOptions.filter(o => !(o.collegeCode === collegeCode && o.branch === branch));
    simSavedOptions.forEach((o, i) => {
        o.priority = i + 1;
    });
    showToast("Option Removed", `Successfully deleted ${collegeCode} option!`, "check-circle");
    renderSimWorkspace();
    openSimViewOptionsModal();
}

function openSimChangePwdModal() {
    const modal = document.getElementById('sim-change-pwd-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSimChangePwdModal() {
    const modal = document.getElementById('sim-change-pwd-modal');
    if (modal) modal.classList.add('hidden');
}

function saveSimChangePassword() {
    const oldP = document.getElementById('sim-change-old-pwd')?.value;
    const newP = document.getElementById('sim-change-new-pwd')?.value;
    const confirmP = document.getElementById('sim-change-confirm-pwd')?.value;

    if (oldP !== simPassword) {
        showToast("Incorrect Password", "The current password entered is incorrect.", "alert-triangle");
        return;
    }
    if (!newP || newP.length < 6) {
        showToast("Invalid Password", "New password must be at least 6 characters.", "alert-triangle");
        return;
    }
    if (newP !== confirmP) {
        showToast("Mismatch", "Confirmed passwords do not match.", "alert-triangle");
        return;
    }

    simPassword = newP;
    closeSimChangePwdModal();
    showToast("Password Saved", "Portal credentials updated successfully!", "check-circle");
}

function handleSimSaveOptions() {
    const indicator = document.getElementById('sim-autosave-indicator');
    if (indicator) {
        indicator.innerText = "Saving changes...";
        setTimeout(() => {
            indicator.innerText = "All changes saved";
            showToast("Options Saved", "Draft priorities list saved on server database!", "check-circle");
        }, 500);
    }
}

function handleSimLogoutFlow() {
    if (simSavedOptions.length === 0) {
        showToast("No Options", "Please add at least one preference option before logging out.", "alert-triangle");
        return;
    }

    const container = document.getElementById('sim-final-options-list');
    if (container) {
        container.innerHTML = "";
        simSavedOptions.forEach(o => {
            const item = document.createElement('div');
            item.className = "flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold mb-2";
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">${o.priority}</span>
                    <div>
                        <span class="block text-slate-800 font-bold">${o.collegeCode} - ${o.branch}</span>
                        <span class="text-[9px] text-slate-400 block">${o.collegeName}</span>
                    </div>
                </div>
                <span class="text-[10px] text-slate-400 font-bold">${o.district}</span>
            `;
            container.appendChild(item);
        });
    }

    showToast("Logged Out", "Session ended. Options locked and saved.", "check-circle");
    showGuideScreen(16);
}

function printSimSavedOptions() {
    const printWindow = window.open('', '_blank');
    let tableRows = "";
    simSavedOptions.forEach(o => {
        tableRows += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${o.priority}</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${o.collegeCode}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${o.collegeName}</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center;">${o.branch}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${o.district}</td>
            </tr>
        `;
    });

    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET 2026 - Saved Option Sheet</title>
            <style>
                body { font-family: sans-serif; padding: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; }
                h2 { margin-bottom: 5px; }
            </style>
        </head>
        <body onload="window.print()">
            <h2>TG EAPCET 2026 - Locked Options Sheet</h2>
            <p style="margin: 2px 0;"><strong>Candidate Name:</strong> ${maskName(simCandidateName)}</p>
            <p style="margin: 2px 0;"><strong>Hall Ticket Number:</strong> ${maskHallTicket(simHallTicket)}</p>
            <p style="margin: 2px 0;"><strong>Rank:</strong> ${simRank}</p>
            <p style="margin: 2px 0;"><strong>Category:</strong> ${simCategory}</p>
            <hr>
            <table>
                <thead>
                    <tr>
                        <th>Priority</th>
                        <th>College Code</th>
                        <th>College Name</th>
                        <th>Branch</th>
                        <th>District</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadSimOptionsPdf() {
    printSimSavedOptions();
}

// ================= SIMULATOR SEAT ALLOTMENT & ADMISSION PROCESS =================
let simAllottedCollege = "JNTUH UNIVERSITY COLLEGE OF ENGG SCI AND TECH HYDERABAD";
let simAllottedCollegeCode = "JNTH";
let simAllottedBranch = "CSE - COMPUTER SCIENCE AND ENGINEERING";
let simAllottedBranchCode = "CSE";
let simTuitionFee = 50000;
let simFeeReimbursement = 35000;
let simNetFee = 15000;

function handleSimProceedToSeatAllotment() {
    // Determine seat allotment dynamically from saved options
    if (simSavedOptions.length > 0) {
        // Pick the top priority option
        const topOption = simSavedOptions[0];
        simAllottedCollegeCode = topOption.collegeCode;
        simAllottedCollege = topOption.collegeName;
        simAllottedBranchCode = topOption.branch;
        
        // Find full name of branch if possible, else use code
        const branchMatch = branchesDataset.find(b => b.code === topOption.branch);
        simAllottedBranch = branchMatch ? `${topOption.branch} - ${branchMatch.name}` : topOption.branch;
        
        // Fetch college fee
        const collegeObj = collegesDataset.find(c => c.inst_code === topOption.collegeCode);
        const feeStr = collegeObj ? collegeObj.fee : "₹50,000";
        // Parse fee number
        const parsedFee = parseInt(feeStr.replace(/[^\d]/g, ''));
        simTuitionFee = isNaN(parsedFee) ? 50000 : parsedFee;
    } else {
        // Fallback defaults
        simAllottedCollegeCode = "JNTH";
        simAllottedCollege = "JNTUH UNIVERSITY COLLEGE OF ENGG SCI AND TECH HYDERABAD";
        simAllottedBranchCode = "CSE";
        simAllottedBranch = "CSE - COMPUTER SCIENCE AND ENGINEERING";
        simTuitionFee = 50000;
    }

    // Calculate EWS Fee Reimbursement (up to 35,000 for EWS, or full if fee is smaller)
    simFeeReimbursement = Math.min(35000, simTuitionFee);
    simNetFee = simTuitionFee - simFeeReimbursement;

    // Reset screen elements for clean re-run
    const selectionBlock = document.getElementById('sim-payment-selection-block');
    const overlay = document.getElementById('sim-payment-gateway-overlay');
    const successPanel = document.getElementById('sim-payment-success-panel');
    if (selectionBlock) selectionBlock.classList.remove('hidden');
    if (overlay) overlay.classList.add('hidden');
    if (successPanel) successPanel.classList.add('hidden');

    const selfActionBlock = document.getElementById('sim-selfreport-action-block');
    const selfBtn = document.getElementById('sim-selfreport-btn');
    const selfSuccessPanel = document.getElementById('sim-selfreport-success-panel');
    if (selfActionBlock) selfActionBlock.classList.remove('hidden');
    if (selfBtn) selfBtn.classList.remove('hidden');
    if (selfSuccessPanel) selfSuccessPanel.classList.add('hidden');

    // Update Screen 17 DOM elements
    const allottedCollegeEl = document.getElementById('sim-allotted-college-name');
    if (allottedCollegeEl) allottedCollegeEl.innerText = `${simAllottedCollegeCode} - ${simAllottedCollege}`;
    
    const allottedBranchEl = document.getElementById('sim-allotted-branch-name');
    if (allottedBranchEl) allottedBranchEl.innerText = simAllottedBranch;

    // Update Screen 18 DOM elements
    const payCollegeEl = document.getElementById('sim-pay-college');
    if (payCollegeEl) payCollegeEl.innerText = `${simAllottedCollegeCode} - ${simAllottedCollege}`;
    
    const payBranchEl = document.getElementById('sim-pay-branch');
    if (payBranchEl) payBranchEl.innerText = simAllottedBranchCode;
    
    const payTuitionEl = document.getElementById('sim-pay-tuition');
    if (payTuitionEl) payTuitionEl.innerText = `₹${simTuitionFee.toLocaleString('en-IN')}`;
    
    const payReimbursementEl = document.getElementById('sim-pay-reimbursement');
    if (payReimbursementEl) payReimbursementEl.innerText = `- ₹${simFeeReimbursement.toLocaleString('en-IN')}`;
    
    const payNetEl = document.getElementById('sim-pay-net');
    if (payNetEl) payNetEl.innerText = `₹${simNetFee.toLocaleString('en-IN')}`;

    // Update Screen 19 DOM elements
    const reportCollegeEl = document.getElementById('sim-report-college');
    if (reportCollegeEl) reportCollegeEl.innerText = `${simAllottedCollegeCode} - ${simAllottedCollege}`;
    
    const reportBranchEl = document.getElementById('sim-report-branch');
    if (reportBranchEl) reportBranchEl.innerText = simAllottedBranchCode;

    // Update Screen 20 DOM elements
    const joinCollegeEl = document.getElementById('sim-join-college-name');
    if (joinCollegeEl) joinCollegeEl.innerText = `${simAllottedCollegeCode} - ${simAllottedCollege}`;
    
    const joinBranchEl = document.getElementById('sim-join-branch-name');
    if (joinBranchEl) joinBranchEl.innerText = simAllottedBranch;

    // Update Screen 21 DOM elements
    const ledgerFeeEl = document.getElementById('sim-ledger-fee-amount');
    if (ledgerFeeEl) ledgerFeeEl.innerText = `₹${simNetFee.toLocaleString('en-IN')}`;

    // Proceed to Screen 17
    showGuideScreen(17);
}

function togglePaymentSelection(mode) {
    const cardLbl = document.getElementById('payment-card-lbl');
    const netbankingLbl = document.getElementById('payment-netbanking-lbl');
    const upiLbl = document.getElementById('payment-upi-lbl');

    if (!cardLbl || !netbankingLbl || !upiLbl) return;

    // Reset styles
    [cardLbl, netbankingLbl, upiLbl].forEach(lbl => {
        lbl.className = "border border-slate-200 p-3 rounded-xl cursor-pointer flex flex-col items-center gap-1.5 text-center text-xs font-semibold transition-all hover:border-purple-200";
    });

    // Select active style
    const activeLbl = document.getElementById(`payment-${mode}-lbl`);
    if (activeLbl) {
        activeLbl.className = "border-2 border-purple-500 bg-purple-50/50 p-3 rounded-xl cursor-pointer flex flex-col items-center gap-1.5 text-center text-xs font-bold transition-all shadow-sm";
    }
}

function simulateTuitionPayment() {
    const selectionBlock = document.getElementById('sim-payment-selection-block');
    const overlay = document.getElementById('sim-payment-gateway-overlay');
    const successPanel = document.getElementById('sim-payment-success-panel');

    if (!selectionBlock || !overlay || !successPanel) return;

    selectionBlock.classList.add('hidden');
    overlay.classList.remove('hidden');

    setTimeout(() => {
        overlay.classList.add('hidden');
        successPanel.classList.remove('hidden');
        showToast("Payment Successful", `Tuition fee payment of ₹${simNetFee.toLocaleString('en-IN')} received.`, "check-circle");
    }, 2500);
}

function submitSelfReporting() {
    const actionBlock = document.getElementById('sim-selfreport-action-block');
    const btn = document.getElementById('sim-selfreport-btn');
    const successPanel = document.getElementById('sim-selfreport-success-panel');

    if (!actionBlock || !btn || !successPanel) return;

    actionBlock.classList.add('hidden');
    btn.classList.add('hidden');
    successPanel.classList.remove('hidden');

    showToast("Self-Report Submitted", "Online joining registered successfully on the board system.", "check-circle");
}

function handleDownloadAllotmentOrder() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET - Allotment Order</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 30px; color: #000; font-size: 13px; line-height: 1.5; }
                .header { text-align: center; font-weight: bold; margin-bottom: 20px; text-decoration: underline; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                td { padding: 6px; }
                .bordered { border: 1px solid #000; }
                .bordered th, .bordered td { border: 1px solid #000; padding: 8px; }
                .footer { margin-top: 40px; text-align: right; }
                .inst { margin-top: 25px; font-size: 11px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                TELANGANA STATE COUNCIL OF HIGHER EDUCATION<br>
                TG EAPCET - 2026 ADMISSIONS CAMP<br>
                PROVISIONAL ALLOTMENT ORDER
            </div>
            <p><strong>Allotment Date:</strong> 19-07-2025</p>
            <p>This is to inform that the candidate has been provisionally allotted a seat based on rank and choices in option entry:</p>
            
            <table class="bordered">
                <tr>
                    <td><strong>Candidate Name</strong></td>
                    <td>${maskName(simCandidateName)}</td>
                    <td><strong>Hall Ticket No</strong></td>
                    <td>${maskHallTicket(simHallTicket)}</td>
                </tr>
                <tr>
                    <td><strong>Father's Name</strong></td>
                    <td>S REDDY</td>
                    <td><strong>Rank</strong></td>
                    <td>${simRank}</td>
                </tr>
                <tr>
                    <td><strong>Category</strong></td>
                    <td>${simCategory}</td>
                    <td><strong>Gender / Region</strong></td>
                    <td>MALE / OU</td>
                </tr>
                <tr>
                    <td><strong>Allotted College</strong></td>
                    <td colspan="3"><strong>${simAllottedCollegeCode} - ${simAllottedCollege}</strong></td>
                </tr>
                <tr>
                    <td><strong>Allotted Branch</strong></td>
                    <td>${simAllottedBranch}</td>
                    <td><strong>Allotment Category</strong></td>
                    <td>EWS_GEN_OU</td>
                </tr>
            </table>

            <h4 style="margin-top: 20px; text-decoration: underline;">Fee Settlement details:</h4>
            <table class="bordered">
                <tr>
                    <th style="text-align: left;">Description</th>
                    <th style="text-align: right;">Amount (INR)</th>
                </tr>
                <tr>
                    <td>Tuition Fee Fixed for Allotted College</td>
                    <td style="text-align: right;">₹${simTuitionFee.toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                    <td>Less: Fee Reimbursement (Eligible Category)</td>
                    <td style="text-align: right; color: green;">- ₹${simFeeReimbursement.toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                    <td><strong>Net Tuition Fee Payable by Candidate</strong></td>
                    <td style="text-align: right;"><strong>₹${simNetFee.toLocaleString('en-IN')}.00</strong></td>
                </tr>
            </table>

            <div class="inst">
                <strong>INSTRUCTIONS TO CANDIDATE:</strong><br>
                1. Pay the net tuition fee online through the payment portal.<br>
                2. After payment, self-report online at the portal to accept the seat.<br>
                3. Final physical reporting at the allotted college must be completed by submitting the Allotment Order and Joining Report.
            </div>

            <div class="footer">
                <br><br>
                CONVENER<br>
                TG EAPCET - 2026 ADMISSIONS
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function handlePrintJoiningReport() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET - Joining Report</title>
            <style>
                body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px; }
                .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .details-table td { padding: 8px; border: 1px solid #ddd; }
                .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
                .notice { background: #f9f9f9; padding: 15px; border-left: 4px solid #4f46e5; margin-top: 30px; font-size: 0.9em; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <h2>TG EAPCET - 2026 ADMISSIONS</h2>
                <h3>CANDIDATE JOINING REPORT (CONFIRMED)</h3>
            </div>
            
            <p>To,<br>The Principal,<br><strong>${simAllottedCollegeCode} - ${simAllottedCollege}</strong></p>
            
            <p>Sir/Madam,</p>
            <p>In response to the provisional allotment order dated 19-07-2025, I hereby report in person/online at your college in the branch <strong>${simAllottedBranch}</strong>. My credentials are as follows:</p>
            
            <table class="details-table">
                <tr>
                    <td><strong>Hall Ticket Number</strong></td>
                    <td>${maskHallTicket(simHallTicket)}</td>
                    <td><strong>Rank</strong></td>
                    <td>${simRank}</td>
                </tr>
                <tr>
                    <td><strong>Candidate Name</strong></td>
                    <td>${maskName(simCandidateName)}</td>
                    <td><strong>Father Name</strong></td>
                    <td>${maskName("Parent Demo")}</td>
                </tr>
                <tr>
                    <td><strong>Admission Number</strong></td>
                    <td>${maskAdmissionNo(`ADM-${simHallTicket}-98`)}</td>
                    <td><strong>Admission Date</strong></td>
                    <td>19-07-2025</td>
                </tr>
                <tr>
                    <td><strong>Category / Gender</strong></td>
                    <td>${simCategory} / BOYS</td>
                    <td><strong>Transaction Hash</strong></td>
                    <td>${maskTransactionId(`TXN${simHallTicket}026859`)}</td>
                </tr>
            </table>

            <div class="notice">
                <strong>Important Note:</strong> This report is generated upon successful online self-reporting. Please submit this document along with the original Allotment Order and verification certificates at the college counter.
            </div>

            <div class="signature-section">
                <div>
                    <br><br>
                    ---------------------------<br>
                    Signature of the Candidate
                </div>
                <div style="text-align: right;">
                    <br><br>
                    ---------------------------<br>
                    Principal / Admission Cell
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function handlePrintTransactions() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET - Transaction Ledger</title>
            <style>
                body { font-family: sans-serif; padding: 30px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body onload="window.print()">
            <h2>TG EAPCET 2026 - Transaction Ledger</h2>
            <p><strong>Candidate Name:</strong> ${maskName(simCandidateName)}</p>
            <p><strong>Hall Ticket No:</strong> ${maskHallTicket(simHallTicket)}</p>
            <hr>
            <table>
                <thead>
                    <tr>
                        <th>Transaction ID</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${maskTransactionId(`TXN${simHallTicket}102640`)}</td>
                        <td>Counselling Processing Fee</td>
                        <td>28-06-2025</td>
                        <td>₹1,200.00</td>
                        <td>SUCCESS</td>
                    </tr>
                    <tr>
                        <td>${maskTransactionId(`TXN${simHallTicket}026859`)}</td>
                        <td>Tuition Fee Payment</td>
                        <td>19-07-2025</td>
                        <td>₹${simNetFee.toLocaleString('en-IN')}.00</td>
                        <td>SUCCESS</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function handlePrintAdmissionSummary() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET - Admission Summary</title>
            <style>
                body { font-family: sans-serif; padding: 30px; line-height: 1.6; }
                .heading { text-align: center; border-bottom: 2px double #333; padding-bottom: 10px; }
                .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin: 20px 0; }
                .details-grid div { padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
                .stage-list { margin-top: 20px; }
                .stage-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
                .checked { color: green; font-weight: bold; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="heading">
                <h2>TG EAPCET Admissions - 2026</h2>
                <h3>FINAL ADMISSION SUMMARY SHEET</h3>
            </div>
            
            <div class="details-grid">
                <div>Candidate Name: <strong>${maskName(simCandidateName)}</strong></div>
                <div>Hall Ticket No: <strong>${maskHallTicket(simHallTicket)}</strong></div>
                <div>Allotted College: <strong>${simAllottedCollegeCode} - ${simAllottedCollege}</strong></div>
                <div>Allotted Branch: <strong>${simAllottedBranch}</strong></div>
                <div>Admission Number: <strong>${maskAdmissionNo(`ADM-${simHallTicket}-98`)}</strong></div>
                <div>Net Tuition Fee Paid: <strong>₹${simNetFee.toLocaleString('en-IN')}.00</strong></div>
            </div>

            <h3>Completed Counselling Steps:</h3>
            <div class="stage-list">
                <div class="stage-item"><span class="checked">✓</span> Processing Fee & Slot Booking (${maskTransactionId(`TXN${simHallTicket}102640`)})</div>
                <div class="stage-item"><span class="checked">✓</span> Certificate Helpline Verification (Completed)</div>
                <div class="stage-item"><span class="checked">✓</span> Web Option Entry (Locked Hash: ${maskLoginId(`TGE${simHallTicket}`)}-A9B8C)</div>
                <div class="stage-item"><span class="checked">✓</span> Provisional Seat Allotment (Allotted)</div>
                <div class="stage-item"><span class="checked">✓</span> Tuition Fee Payment (${maskTransactionId(`TXN${simHallTicket}026859`)})</div>
                <div class="stage-item"><span class="checked">✓</span> Self-Reporting & Joining Report Generated</div>
            </div>

            <p style="margin-top: 40px; font-size: 0.9em; text-align: center; color: #666;">
                This document is a simulated admissions summary generated by the TG EAPCET Counselling Companion.
            </p>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function toggleScheduleTab(tabIndex) {
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`sched-tab-btn-${i}`);
        const content = document.getElementById(`sched-tab-content-${i}`);
        if (!btn || !content) continue;

        if (i === tabIndex) {
            btn.className = "px-6 py-3 rounded-xl text-xs font-extrabold transition-all border border-indigo-200 bg-indigo-50/80 text-indigo-700 shadow-sm flex items-center gap-2";
            content.classList.remove('hidden');
        } else {
            btn.className = "px-6 py-3 rounded-xl text-xs font-extrabold transition-all border border-transparent text-slate-600 hover:bg-slate-100 flex items-center gap-2";
            content.classList.add('hidden');
        }
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function scrollToSchedulePanel() {
    const el = document.getElementById('schedule-details-panel');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function downloadNotificationSummary() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET Counselling - Notification Summary</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
                .header { text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
                .gov-label { font-size: 11px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 2px; }
                h1 { font-size: 26px; font-weight: 900; color: #1e293b; margin: 5px 0 10px 0; }
                h2 { font-size: 16px; font-weight: 800; color: #4f46e5; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
                h3 { font-size: 13px; font-weight: 700; color: #334155; margin-top: 20px; }
                p { font-size: 12px; margin: 5px 0 15px 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 11px; }
                th { background-color: #f8fafc; font-weight: 700; color: #475569; }
                .badge { display: inline-block; padding: 2px 8px; font-size: 9px; font-weight: 800; border-radius: 9999px; text-transform: uppercase; }
                .badge-warn { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
                .footer { text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 50px; padding-top: 15px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <div class="gov-label">State Council of Higher Education, Telangana</div>
                <h1>TG EAPCET Admissions - Counselling Notification Summary</h1>
                <div class="badge badge-warn">Awaiting Official Timeline Updates</div>
            </div>

            <p>This document presents a structured workflow and operational sequence derived from the official TG EAPCET admission notification guidelines. All absolute dates are placeholder markers and will be finalized upon the release of the official board notification.</p>

            <h2>I. Chronological Sequence of Activities</h2>
            
            <h3>1. First Phase Sequence</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">S.No</th>
                        <th style="width: 65%;">Counselling Stage Activity Description</th>
                        <th style="width: 30%;">Expected Timeline</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Online filing of Basic Information, payment of Processing Fee & HLC Slot Booking</td><td>Expected Soon (TBA)</td></tr>
                    <tr><td>2</td><td>Certificate Verification in-person for slot booked candidates at selected HLCs</td><td>Expected Soon (TBA)</td></tr>
                    <tr><td>3</td><td>Exercising Web Options (College & Branch Priority List Selection)</td><td>Expected Soon (TBA)</td></tr>
                    <tr><td>4</td><td>Freezing of Web Options (Auto-locking of option selections)</td><td>Expected Soon (TBA)</td></tr>
                    <tr><td>5</td><td>Provisional Seat Allotment (Published on portal via candidate login)</td><td>Expected Soon (TBA)</td></tr>
                    <tr><td>6</td><td>Payment of Tuition Fee & Web Self-Reporting to secure provisionally allotted seat</td><td>Expected Soon (TBA)</td></tr>
                </tbody>
            </table>

            <h3>2. Second Phase Sequence</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">S.No</th>
                        <th style="width: 65%;">Counselling Stage Activity Description</th>
                        <th style="width: 30%;">Expected Timeline</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Filing details, paying Processing Fee, and booking HLC slots (Leftover candidates)</td><td>Will Be Updated</td></tr>
                    <tr><td>2</td><td>In-person certificate verification at selected HLCs</td><td>Will Be Updated</td></tr>
                    <tr><td>3</td><td>Exercising Web Options (Fresh priority entries are mandatory; Phase 1 entries discarded)</td><td>Will Be Updated</td></tr>
                    <tr><td>4</td><td>Freezing of Web Options</td><td>Will Be Updated</td></tr>
                    <tr><td>5</td><td>Provisional Seat Allotment</td><td>Will Be Updated</td></tr>
                    <tr><td>6</td><td>Payment of Tuition Fee & Web Self-Reporting</td><td>Will Be Updated</td></tr>
                </tbody>
            </table>

            <h3>3. Final Phase Sequence</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">S.No</th>
                        <th style="width: 65%;">Counselling Stage Activity Description</th>
                        <th style="width: 30%;">Expected Timeline</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Final call for registration, fee payment, and HLC certificate verification</td><td>Awaiting Notification</td></tr>
                    <tr><td>2</td><td>Exercising Web Options (Fresh priority entries required)</td><td>Awaiting Notification</td></tr>
                    <tr><td>3</td><td>Provisional Seat Allotment</td><td>Awaiting Notification</td></tr>
                    <tr><td>4</td><td>Payment of Tuition Fee & Web Self-Reporting</td><td>Awaiting Notification</td></tr>
                    <tr><td>5</td><td>Mandatory physical reporting at allotted college (Submit original TC & Xerox certificate sets)</td><td>Awaiting Notification</td></tr>
                    <tr><td>6</td><td>Updating Joining details by colleges</td><td>Awaiting Notification</td></tr>
                </tbody>
            </table>

            <h2>II. Critical Rules & Policies Summary</h2>
            <ul>
                <li><strong>Tuition Fee Minimum Payment:</strong> Candidates must pay online a minimum of ₹5,000 (SC/ST) or ₹10,000 (Others) if the final calculated net tuition fee in their allotment order is below these threshold amounts. The minimum deposit is refunded if the candidate reports at the college, or forfeited if they fail to join.</li>
                <li><strong>Physical College Reporting:</strong> Reporting physically at the allotted college is mandatory after the Final Phase. Web self-reporting alone does not secure the seat, and failure to report physically results in seat cancellation.</li>
                <li><strong>Internal Sliding:</strong> Post-counselling branch adjustments are conducted within reported colleges. Slid candidates retain eligibility for fee reimbursement. Dropout/cancellations after sliding are strictly prohibited.</li>
                <li><strong>Spot Admissions:</strong> Leftover vacancy spots are filled directly by private unaided colleges. Priority is given to qualified candidates. Spot admission candidates are not eligible for government fee reimbursement.</li>
            </ul>

            <div class="footer">
                Generated by TG EAPCET Counselling Companion Dashboard. All procedures conform to the State Board Notification structure.
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadCounsellingChecklist() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET Certificate Verification Checklist</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
                .header { text-align: center; border-bottom: 2px solid #8b5cf6; padding-bottom: 20px; margin-bottom: 30px; }
                .gov-label { font-size: 11px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 2px; }
                h1 { font-size: 26px; font-weight: 900; color: #1e293b; margin: 5px 0 10px 0; }
                .candidate-info { display: flex; justify-content: space-between; border: 1px solid #cbd5e1; padding: 15px; border-radius: 10px; margin-bottom: 35px; background-color: #f8fafc; }
                .candidate-info div { font-size: 12px; font-weight: 600; color: #475569; }
                .candidate-info span { border-bottom: 1px dashed #64748b; padding: 0 40px; font-weight: 700; color: #1e293b; }
                h2 { font-size: 15px; font-weight: 800; color: #7c3aed; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; font-size: 11px; }
                th { background-color: #f1f5f9; font-weight: 700; color: #475569; }
                .check-box { width: 18px; text-align: center; font-size: 14px; font-weight: bold; cursor: pointer; border: 1px solid #94a3b8; border-radius: 3px; display: inline-block; height: 18px; line-height: 18px; }
                .note { font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px; display: block; }
                .footer { text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 50px; padding-top: 15px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <div class="gov-label">State Council of Higher Education, Telangana</div>
                <h1>TG EAPCET Certificate Verification Checklist</h1>
            </div>

            <div class="candidate-info">
                <div>Candidate Name: <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
                <div>Hall Ticket Number: <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
                <div>Rank Secured: <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
            </div>

            <h2>I. Mandatory Documents for Certificate Verification (All Categories)</h2>
            <p>Produce original certificates and **two sets of xerox copies** in the following chronological order:</p>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%; text-align: center;">Verify</th>
                        <th style="width: 25%;">Required Document Name</th>
                        <th style="width: 70%;">Official Description / Validation Criteria</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>TGEAPCET Rank Card</strong></td>
                        <td>Official rank card downloaded from portal showing score and stream statistics.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>TGEAPCET Hall Ticket</strong></td>
                        <td>Entrance exam admit card showing candidate photo and roll number.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Aadhar Card</strong></td>
                        <td>Original card for biometric and identity validation.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>S.S.C (10th) Marks Memo</strong></td>
                        <td>Marks memorandum or equivalent showing name, date of birth and secondary details.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Intermediate (12th) Marks Memo</strong></td>
                        <td>Memo-Cum-Pass Certificate verifying eligibility marks (45% for OC, 40% for Reserved categories in group subjects).</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Class VI to Intermediate Study</strong></td>
                        <td>Institutional certificates showing study details. Crucial for establishing local candidate status (local vs non-local).</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Transfer Certificate (T.C.)</strong></td>
                        <td>Leaving certificate issued by Intermediate college. Original TC is submitted to the college upon final reporting.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Income Certificate</strong></td>
                        <td>Income certificate issued by competent authority (Tahsildar) valid for verification year. Essential for Fee Reimbursement.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Caste Certificate</strong></td>
                        <td>Issued by competent authority for BC/SC/ST category validation.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>EWS Certificate</strong></td>
                        <td>Income & Asset Certificate valid for the academic year issued by Tahsildar (if claiming 10% EWS reservation).</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Residence Certificate</strong></td>
                        <td>Required if the candidate has no institutionalized study (private candidates) covering 7 years prior to qualifying exam.</td>
                    </tr>
                </tbody>
            </table>

            <h2>II. Special Reservations Checklist (PHC/CAP/NCC/Sports/ANG)</h2>
            <p>Produce original certificates and **three sets of xerox copies** strictly at GP Masab Tank Helpline Centre:</p>

            <table>
                <thead>
                    <tr>
                        <th style="width: 5%; text-align: center;">Verify</th>
                        <th style="width: 25%;">Reservation Category</th>
                        <th style="width: 70%;">Required Documents and Validation Authorities</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Physically Challenged (PHC)</strong></td>
                        <td>Certificate from the District Medical Board. Eligibility minimum is 40% and above physical disability.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Children of Armed Forces (CAP)</strong></td>
                        <td>CAP certificate from Regional Sainik Welfare Officer (for Ex-servicemen) or Unit CO (for serving defense/BSF/CRPF) along with Service Register copies.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>National Cadet Corps (NCC)</strong></td>
                        <td>Original certificates issued by competent NCC military authorities.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Sports Category (SG)</strong></td>
                        <td>Sports achievements/testimonials along with Form I/II/III/IV attested by SATG.</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;"><span class="check-box">&nbsp;</span></td>
                        <td><strong>Anglo-Indian (ANG)</strong></td>
                        <td>Anglo-Indian residential certificate issued by the Tahsildar.</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                Checklist sheet generated for verification reference. Double check that names match across SSC memo and certificates.
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadPhasePlanner() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET Counselling - Phase Planning Worksheet</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
                .header { text-align: center; border-bottom: 2px solid #d97706; padding-bottom: 20px; margin-bottom: 30px; }
                .gov-label { font-size: 11px; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 2px; }
                h1 { font-size: 26px; font-weight: 900; color: #1e293b; margin: 5px 0 10px 0; }
                .planner-note { padding: 12px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 11px; color: #b45309; margin-bottom: 25px; font-weight: 600; }
                h2 { font-size: 15px; font-weight: 800; color: #d97706; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; font-size: 11px; }
                th { background-color: #fcf8f3; font-weight: 700; color: #78350f; }
                .status-col { width: 10%; text-align: center; font-size: 10px; font-weight: bold; color: #cbd5e1; border: 1px solid #cbd5e1; }
                .date-col { width: 25%; font-weight: bold; color: #475569; }
                .notes-col { width: 35%; color: #94a3b8; font-style: italic; }
                .footer { text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 50px; padding-top: 15px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <div class="gov-label">State Council of Higher Education, Telangana</div>
                <h1>TG EAPCET Counselling - Phase Planning Worksheet</h1>
            </div>

            <div class="planner-note">
                Instructions: Keep track of schedules as they are released in the news. Write down your slot timings, helpline center choices, and key login credentials on this printed sheet. Keep this in a secure file folder with your certificates.
            </div>

            <h2>Phase 01: Initial Admissions Schedule</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">Counselling Process Milestone</th>
                        <th class="date-col">Official Schedule</th>
                        <th class="notes-col">Your Planned Date / Notes</th>
                        <th class="status-col">Check</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Payment of Processing Fee</strong></td>
                        <td>TBA (Expected Soon)</td>
                        <td>Amt paid: ____________ Date: _______</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>HLC Slot Booking</strong></td>
                        <td>TBA (Expected Soon)</td>
                        <td>HLC Code: _________ Time: _______</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Helpline Certificate Verification</strong></td>
                        <td>TBA (Expected Soon)</td>
                        <td>ROC Reference No: _________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Web Options Entry Period</strong></td>
                        <td>TBA (Expected Soon)</td>
                        <td>Locked Option Count: ______________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Provisional Seat Allotment</strong></td>
                        <td>TBA (Expected Soon)</td>
                        <td>Allotted College/Branch: ____________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Tuition Fee Payment & Self-Report</strong></td>
                        <td>TBA (Expected Soon)</td>
                        <td>Admission No: ______________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                </tbody>
            </table>

            <h2>Phase 02: Leftover & Sliding Seat Schedule</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">Counselling Process Milestone</th>
                        <th class="date-col">Official Schedule</th>
                        <th class="notes-col">Your Planned Date / Notes</th>
                        <th class="status-col">Check</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Basic Info Submission (if missed P1)</strong></td>
                        <td>Will Be Updated</td>
                        <td>Date: _____________________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>HLC Certificate Verification</strong></td>
                        <td>Will Be Updated</td>
                        <td>Helpline Center: __________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Fresh Web Option Entry (Mandatory)</strong></td>
                        <td>Will Be Updated</td>
                        <td>Locked Count: ____________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Provisional Seat Allotment</strong></td>
                        <td>Will Be Updated</td>
                        <td>Allotted College/Branch: ____________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Tuition Fee Payment & Self-Report</strong></td>
                        <td>Will Be Updated</td>
                        <td>Date: ____________ Txn ID: _________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                </tbody>
            </table>

            <h2>Phase 03: Final Round & Joining Schedule</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">Counselling Process Milestone</th>
                        <th class="date-col">Official Schedule</th>
                        <th class="notes-col">Your Planned Date / Notes</th>
                        <th class="status-col">Check</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Final Verification & Web Options</strong></td>
                        <td>Awaiting Notification</td>
                        <td>Date: _____________________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Provisional Seat Allotment (Final)</strong></td>
                        <td>Awaiting Notification</td>
                        <td>Final College Code: _______________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Fee Settlement & Online Reporting</strong></td>
                        <td>Awaiting Notification</td>
                        <td>Self reporting done: ________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Mandatory Physical Reporting at College</strong></td>
                        <td>Awaiting Notification</td>
                        <td>Original TC submitted: [ &nbsp; ] Date: ____</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                    <tr>
                        <td><strong>Centralized Internal Sliding Options</strong></td>
                        <td>Awaiting Notification</td>
                        <td>Slid branch: ______________________</td>
                        <td>[ &nbsp; ]</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                Worksheet planner document generated. Keep this sheet secure. Never share your candidate passwords.
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadDocPrepSheet() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>TG EAPCET Special Categories & HLC Preparation Sheet</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
                .header { text-align: center; border-bottom: 2px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
                .gov-label { font-size: 11px; font-weight: 800; color: #ea580c; text-transform: uppercase; letter-spacing: 2px; }
                h1 { font-size: 26px; font-weight: 900; color: #1e293b; margin: 5px 0 10px 0; }
                .center-box { border: 1.5px solid #ea580c; background-color: #fff7ed; padding: 15px; border-radius: 12px; margin-bottom: 30px; }
                .center-box h3 { margin: 0 0 5px 0; font-size: 13px; font-weight: 800; color: #c2410c; text-transform: uppercase; }
                .center-box p { margin: 0; font-size: 11.5px; font-weight: 600; color: #7c2d12; line-height: 1.4; }
                h2 { font-size: 15px; font-weight: 800; color: #ea580c; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
                h3 { font-size: 12.5px; font-weight: 800; color: #1e293b; margin-top: 20px; margin-bottom: 8px; }
                ul { font-size: 11.5px; margin: 5px 0 15px 0; padding-left: 20px; color: #475569; }
                li { margin-bottom: 6px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 10.5px; }
                th { background-color: #fefaf8; font-weight: 700; color: #7c2d12; }
                .footer { text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 50px; padding-top: 15px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <div class="gov-label">State Council of Higher Education, Telangana</div>
                <h1>TG EAPCET - Special Reservation Categories & HLC Preparation Sheet</h1>
            </div>

            <div class="center-box">
                <h3>Mandatory Venue for Special Category Verification</h3>
                <p>
                    All Special Category candidates (Physically Challenged (PHC), Children of Armed Forces Personnel (CAP), National Cadet Corps (NCC), Sports (SG) and Anglo-Indian (ANG)) must book slots and report for verification ONLY at the **GOVERNMENT POLYTECHNIC, MASABTANK, HYDERABAD**. These certificates will NOT be verified at any other Helpline Centre, and verification is conducted during the First Phase schedule only.
                </p>
            </div>

            <h2>I. Official Verification Timing Sequence</h2>
            <table>
                <thead>
                    <tr>
                        <th>Special Reservation Category</th>
                        <th>Standard Slot Timings</th>
                        <th>Verification Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>SG (SPORTS)</strong></td>
                        <td>10:00 to 10:30 AM | 11:00 to 11:30 AM | 12:00 to 12:30 PM | 02:00 to 02:30 PM | 03:00 to 03:30 PM | 04:00 to 04:30 PM | 05:00 to 05:30 PM</td>
                        <td>Expected Soon (TBA)</td>
                    </tr>
                    <tr>
                        <td><strong>CAP (Children of Armed Forces Personnel)</strong></td>
                        <td>10:30 to 11:00 AM | 11:30 AM to 12:00 Noon | 12:30 to 01:00 PM | 02:30 to 03:00 PM | 03:30 to 04:00 PM | 04:30 to 05:00 PM | 05:30 to 06:00 PM</td>
                        <td>Expected Soon (TBA)</td>
                    </tr>
                    <tr>
                        <td><strong>NCC (National Cadet Corps)</strong></td>
                        <td>10:00 to 10:30 AM | 11:00 to 11:30 AM | 12:00 to 12:30 PM | 02:00 to 02:30 PM | 03:00 to 03:30 PM | 04:00 to 04:30 PM | 05:00 to 05:30 PM</td>
                        <td>Expected Soon (TBA)</td>
                    </tr>
                    <tr>
                        <td><strong>PHC (Physically Challenged)</strong></td>
                        <td>09:30 to 10:00 AM | 10:00 to 10:30 AM | 10:30 to 11:00 AM | 11:00 to 11:30 AM | 11:30 AM to 12:00 Noon | 12:00 to 12:30 PM</td>
                        <td>Expected Soon (TBA)</td>
                    </tr>
                    <tr>
                        <td><strong>ANG (Anglo-Indian)</strong></td>
                        <td>05:30 to 06:00 PM</td>
                        <td>Expected Soon (TBA)</td>
                    </tr>
                </tbody>
            </table>

            <h2>II. Detailed Reservation Guidelines</h2>

            <h3>1. Children of Armed Forces Personnel (CAP) - 2% Reservation</h3>
            <ul>
                <li><strong>Eligibility:</strong> Children of Ex-Servicemen, Defence Personnel, including BSF and CRPF domiciled in Telangana state based on home address declared at service joining.</li>
                <li><strong>Retired Personnel:</strong> Must produce CAP certificate issued by the respective Regional Sainik Welfare Officer as per Appendix-"A" along with discharge book, pension pay order, and study certificates.</li>
                <li><strong>Serving Personnel:</strong> Must submit a CAP certificate issued by the Unit Commanding Officer (rank of Colonel or equivalent) as per Appendix-"B" along with certified copy of Service Register showing Home Town entry.</li>
            </ul>

            <h3>2. Sports Category (SG)</h3>
            <ul>
                <li><strong>Grades & Forms:</strong> Sports achievements/testimonials must include Form-I, II, III & IV certified by concerned State Sports Associations recognized by the Sports Authority of Telangana (SATG).</li>
                <li><strong>Scrutiny:</strong> Documents are evaluated at Masab Tank and graded into priorities based on the level of championships (National, State, etc.) as per G.O.Ms.No. 02. Allotment is made in subsequent phases after validation.</li>
            </ul>

            <h3>3. National Cadet Corps (NCC) & Physically Challenged (PHC)</h3>
            <ul>
                <li><strong>NCC:</strong> Original C, B, A certificates validated by Directorate of NCC.</li>
                <li><strong>PHC:</strong> Medical Certificate showing visual, hearing, or orthopedic impairment. Minimum eligible disability is 40% as certified by the District Medical Board.</li>
            </ul>

            <h2>III. What to Do After Verification</h2>
            <ul>
                <li><strong>Check Receipt of Certificates (ROC):</strong> Before leaving the verification hall, inspect the ROC printout. Immediately notify the Chief Verification Officer of any spelling mistakes, category errors, or intermediate mark errors.</li>
                <li><strong>Collect Login ID:</strong> A Login ID is automatically texted to your registered mobile number upon successful verification. If not received, report to the helpdesk to retrieve it before leaving the venue. Do not share this Login ID or password.</li>
            </ul>

            <div class="footer">
                Special Category Document Preparation Guide. State Board guidelines apply.
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

window.showGuideScreen = showGuideScreen;
window.advanceFeeStep = advanceFeeStep;
window.simulateFeePaymentProcess = simulateFeePaymentProcess;
window.simulateVerificationProcess = simulateVerificationProcess;
window.handleSimLogin = handleSimLogin;
window.handleSimPayment = handleSimPayment;
window.handleSimVerify = handleSimVerify;
window.handleSimProceedToSlotBooking = handleSimProceedToSlotBooking;
window.initSlotBookingSection = initSlotBookingSection;
window.handleSimSlotLoginAndShow = handleSimSlotLoginAndShow;
window.setSimSlotCategory = setSimSlotCategory;
window.renderSimSlotHlcList = renderSimSlotHlcList;
window.handleSimBookSlot = handleSimBookSlot;
window.closeSimSlotConfirmation = closeSimSlotConfirmation;
window.confirmSimSlotBooking = confirmSimSlotBooking;
window.printSimSlotReceipt = printSimSlotReceipt;
window.handleSimComplete = handleSimComplete;
window.populateSimHlcs = populateSimHlcs;
window.triggerSmsAlert = triggerSmsAlert;
window.checkPwdStrength = checkPwdStrength;
window.handleSimPwdGenerate = handleSimPwdGenerate;
window.handleSimPwdSave = handleSimPwdSave;
window.handleSimPortalLogin = handleSimPortalLogin;
window.resendSimOtp = resendSimOtp;
window.handleSimOtpSubmit = handleSimOtpSubmit;
window.handleSimFilteringSubmit = handleSimFilteringSubmit;
window.updateSimOptionValue = updateSimOptionValue;
window.openSimInsertBetweenModal = openSimInsertBetweenModal;
window.closeSimInsertBetweenModal = closeSimInsertBetweenModal;
window.populateInsertBranches = populateInsertBranches;
window.handleSimInsertBetweenSubmit = handleSimInsertBetweenSubmit;
window.openSimViewOptionsModal = openSimViewOptionsModal;
window.closeSimViewOptionsModal = closeSimViewOptionsModal;
window.removeSimOption = removeSimOption;
window.openSimChangePwdModal = openSimChangePwdModal;
window.closeSimChangePwdModal = closeSimChangePwdModal;
window.saveSimChangePassword = saveSimChangePassword;
window.handleSimSaveOptions = handleSimSaveOptions;
window.handleSimLogoutFlow = handleSimLogoutFlow;
window.printSimSavedOptions = printSimSavedOptions;
window.downloadSimOptionsPdf = downloadSimOptionsPdf;
window.updateFilteredPreview = updateFilteredPreview;
window.toggleSimDistrict = toggleSimDistrict;
window.selectAllSimDistricts = selectAllSimDistricts;
window.handleSimProceedToSeatAllotment = handleSimProceedToSeatAllotment;
window.togglePaymentSelection = togglePaymentSelection;
window.simulateTuitionPayment = simulateTuitionPayment;
window.submitSelfReporting = submitSelfReporting;
window.handleDownloadAllotmentOrder = handleDownloadAllotmentOrder;
window.handlePrintJoiningReport = handlePrintJoiningReport;
window.handlePrintTransactions = handlePrintTransactions;
window.handlePrintAdmissionSummary = handlePrintAdmissionSummary;
window.toggleScheduleTab = toggleScheduleTab;
window.scrollToSchedulePanel = scrollToSchedulePanel;
window.downloadNotificationSummary = downloadNotificationSummary;
window.downloadCounsellingChecklist = downloadCounsellingChecklist;
window.downloadPhasePlanner = downloadPhasePlanner;
window.downloadDocPrepSheet = downloadDocPrepSheet;

// Expose selection workspace components
window.openBranchExplorerModal = openBranchExplorerModal;
window.closeBranchExplorerModal = closeBranchExplorerModal;
window.filterModalBranches = filterModalBranches;
window.quickSelectBranches = quickSelectBranches;
window.openDistrictExplorerModal = openDistrictExplorerModal;
window.closeDistrictExplorerModal = closeDistrictExplorerModal;
window.filterModalDistricts = filterModalDistricts;
window.quickSelectDistricts = quickSelectDistricts;
window.toggleExplorerMap = toggleExplorerMap;
window.onGeneratorSelectionChange = onGeneratorSelectionChange;
window.filterGeneratorDistricts = filterGeneratorDistricts;
window.filterGeneratorBranches = filterGeneratorBranches;
window.toggleInsight = toggleInsight;
window.scrollToCoreModules = scrollToCoreModules;


