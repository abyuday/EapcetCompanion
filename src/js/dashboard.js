export const Dashboard = {
    toggleInsight(index) {
        const content = document.getElementById(`insight-content-${index}`);
        const arrow = document.getElementById(`insight-arrow-${index}`);
        if (content && arrow) {
            content.classList.toggle('hidden');
            arrow.classList.toggle('rotate-180');
        }
    },

    renderPreferencesList(preferences) {
        const container = document.getElementById('preferences-container');
        container.innerHTML = "";

        if (preferences.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center py-16">
                    <i data-lucide="info" class="w-10 h-10 text-slate-300 mb-3"></i>
                    <h4 class="font-bold text-slate-700 text-sm">No colleges matched criteria</h4>
                    <p class="text-xs text-slate-400 mt-1 max-w-xs">Try choosing more branches or districts to expand results.</p>
                </div>`;
            if (typeof window.updateSummaryStats === 'function') window.updateSummaryStats();
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const totalCount = preferences.length;
        const safeCount = preferences.filter(p => p.chance === "SAFE").length;
        const moderateCount = preferences.filter(p => p.chance === "MODERATE").length;

        const matchCountEl = document.getElementById('match-count');
        if (matchCountEl) {
            matchCountEl.className = "text-xs font-semibold text-slate-500 mt-1 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl w-max";
            matchCountEl.innerHTML = `✨ <strong>${totalCount} realistic options</strong> found &bull; <span class="text-emerald-600 font-extrabold">${safeCount} SAFE</span> &bull; <span class="text-amber-600 font-extrabold">${moderateCount} MODERATE</span>`;
        }

        preferences.forEach((item, index) => {
            const preferenceNum = index + 1;
            const card = document.createElement('div');
            // Clean, tighter padding (p-3 sm:p-3.5 instead of p-4), minimal border, larger college names, subtle separator.
            card.className = "p-3 sm:p-3.5 bg-white/90 backdrop-blur-md rounded-xl border border-slate-100 shadow-sm cursor-grab hover:shadow-md hover:border-slate-200 transition-all duration-200 flex flex-col gap-2";
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-index', index);

            const badgeClass = item.chance === 'SAFE' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                : 'bg-amber-50 text-amber-700 border-amber-200/50';

            card.innerHTML = `
                <!-- Top row info -->
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 w-full">
                    <div class="flex items-center gap-3 w-full sm:w-auto">
                        <!-- Left Drag Handles & Order -->
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <span class="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center text-xs font-black border border-purple-100">${preferenceNum}</span>
                            <div class="flex flex-col gap-0.5 sm:flex hidden text-slate-300">
                                <button onclick="window.moveItem(${index}, -1)" title="Move Up" class="hover:text-purple-600"><i data-lucide="chevron-up" class="w-3.5 h-3.5"></i></button>
                                <button onclick="window.moveItem(${index}, 1)" title="Move Down" class="hover:text-purple-600"><i data-lucide="chevron-down" class="w-3.5 h-3.5"></i></button>
                            </div>
                        </div>

                        <!-- Info details: Larger College Name (text-base font-bold vs text-sm font-bold) -->
                        <div class="space-y-0.5">
                            <h4 class="font-extrabold text-slate-800 text-sm leading-tight flex flex-wrap items-center gap-1.5">
                                <span class="text-purple-700">${item.collegeCode}</span> — <span>${item.collegeName}</span>
                            </h4>
                            <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold text-[10px] tracking-wider">${item.branchCode}</span>
                                <span class="text-slate-300">&bull;</span>
                                <span class="flex items-center gap-1 font-medium"><i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i> ${item.district}</span>
                                <span class="text-slate-300">&bull;</span>
                                <span class="font-medium text-slate-600">Cutoff: <span class="font-bold text-slate-700">${item.cutoff.toLocaleString()}</span></span>
                                <span class="text-slate-300">&bull;</span>
                                <span class="font-medium text-slate-600">Phase: <span class="font-bold text-slate-700">${item.phaseSource}</span></span>
                            </div>
                        </div>
                    </div>

                    <!-- Right Controls / Tag -->
                    <div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 border-slate-50 pt-1.5 sm:pt-0">
                        <div class="flex sm:hidden gap-1.5">
                            <button onclick="window.moveItem(${index}, -1)" class="p-1 text-slate-400 hover:text-purple-600 border border-slate-100 rounded-lg"><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                            <button onclick="window.moveItem(${index}, 1)" class="p-1 text-slate-400 hover:text-purple-600 border border-slate-100 rounded-lg"><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                        </div>

                        <div class="flex items-center gap-2 ml-auto">
                            <!-- Chance Badge -->
                            <span class="px-2 py-0.5 text-[10px] font-extrabold rounded border uppercase tracking-wider ${badgeClass}">${item.chance}</span>
                            
                            <!-- Remove button -->
                            <button onclick="window.removeItem(${index})" class="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Remove College">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Bottom Accordion for "Why Suggested?" insight -->
                <div class="border-t border-slate-100/50 pt-1.5 flex flex-col gap-1">
                    <button onclick="window.toggleInsight(${index})" class="flex items-center gap-1 text-[10px] font-extrabold text-purple-600 hover:text-purple-700 transition-colors w-max self-start bg-purple-50/50 hover:bg-purple-100/50 px-2 py-0.5 rounded border border-purple-100/10">
                        <i data-lucide="help-circle" class="w-3 h-3"></i>
                        <span>Why Suggested?</span>
                        <i data-lucide="chevron-down" id="insight-arrow-${index}" class="w-2.5 h-2.5 transition-transform duration-200"></i>
                    </button>
                    <div id="insight-content-${index}" class="hidden text-[11px] text-slate-600 leading-relaxed bg-slate-50/30 p-2.5 rounded-lg border border-slate-100 mt-0.5">
                        ${item.insight}
                    </div>
                </div>
            `;

            card.addEventListener('dragstart', window.handleDragStart);
            card.addEventListener('dragover', window.handleDragOver);
            card.addEventListener('dragleave', window.handleDragLeave);
            card.addEventListener('drop', window.handleDrop);
            card.addEventListener('dragend', window.handleDragEnd);

            container.appendChild(card);
        });

        if (typeof window.updateSummaryStats === 'function') window.updateSummaryStats();
        if (window.lucide) window.lucide.createIcons();
    }
};
