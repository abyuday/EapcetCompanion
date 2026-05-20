import { DatasetParser } from './datasetParser.js';

export function getInflationBuffer(college, branchCode, historicalCutoff, collegeQualityScore) {
    const isUltraHigh = ["CSE", "CSM", "CSD", "AI", "AIDS", "AIML", "DS"].includes(branchCode);
    const isHigh = ["IT", "INF", "ECE"].includes(branchCode) || branchCode.startsWith("CS");
    
    const tierRatio = Math.max(0, Math.min(1, (collegeQualityScore - 500) / 75000));
    
    let baseRate = 0.02;
    if (isUltraHigh) {
        baseRate = 0.12 - (tierRatio * 0.04);
    } else if (isHigh) {
        baseRate = 0.08 - (tierRatio * 0.03);
    } else {
        baseRate = 0.04 - (tierRatio * 0.04);
    }

    if (["Hyderabad", "Rangareddy", "Medchal"].includes(college.district)) {
        baseRate += 0.02;
    }

    return Math.round(historicalCutoff * baseRate);
}

function getSafeGap(rank) {
    if (rank < 5000) return 800;
    if (rank < 15000) return 1200;
    if (rank < 30000) return 1800;
    if (rank < 50000) return 2500;
    return 4000;
}

function getModerateGap(rank) {
    if (rank < 5000) return 2200;
    if (rank < 15000) return 3500;
    if (rank < 30000) return 5500;
    if (rank < 50000) return 8000;
    return 12000;
}

export function evaluateOption(college, branchCode, branchInfo, studentRank, category, gender, phase, collegeQualityScore) {
    const phases = [];
    if (phase === 'Combined') {
        phases.push('phase1', 'phase2', 'finalPhase');
    } else {
        const pKey = phase === 'Phase 1' ? 'phase1' : (phase === 'Phase 2' ? 'phase2' : 'finalPhase');
        phases.push(pKey);
    }

    let cutoffValues = [];
    phases.forEach(p => {
        const cutoffsObj = branchInfo.cutoffs[p];
        if (cutoffsObj) {
            const val = DatasetParser.getExactCutoff(cutoffsObj, category, gender);
            if (val) {
                cutoffValues.push({ phase: p, value: val });
            }
        }
    });

    if (cutoffValues.length === 0) return null;

    let phaseResults = [];

    cutoffValues.forEach(c => {
        const inflationBuffer = getInflationBuffer(college, branchCode, c.value, collegeQualityScore);
        const adjustedCutoff = c.value - inflationBuffer;
        const gap = studentRank - adjustedCutoff;

        // Dynamic gaps based on candidate rank
        const safeGap = getSafeGap(studentRank);
        const moderateGap = getModerateGap(studentRank);

        let chance = null;
        if (studentRank <= adjustedCutoff || gap <= safeGap) {
            chance = "SAFE";
        } else if (gap <= moderateGap) {
            chance = "MODERATE";
        }

        if (chance) {
            phaseResults.push({
                phase: c.phase,
                cutoff: c.value,
                adjustedCutoff,
                inflationBuffer,
                gap,
                chance
            });
        }
    });

    if (phaseResults.length === 0) return null;

    let bestChance = null;
    let selected = null;

    if (phase === 'Combined') {
        // Combined Phase Intelligence
        const p1Result = phaseResults.find(r => r.phase === 'phase1');
        const p2Result = phaseResults.find(r => r.phase === 'phase2');
        const finalResult = phaseResults.find(r => r.phase === 'finalPhase');

        if (p1Result && p1Result.chance === "SAFE") {
            bestChance = "SAFE";
            selected = p1Result;
        } else if (p1Result || p2Result || finalResult) {
            bestChance = "MODERATE";
            // Choose the phase where they qualify with the highest adjusted cutoff (most realistic comparison)
            selected = phaseResults.sort((a, b) => b.adjustedCutoff - a.adjustedCutoff)[0];
        }
    } else {
        selected = phaseResults[0];
        bestChance = selected.chance;
    }

    if (!selected) return null;

    const phaseNameStr = selected.phase === 'phase1' ? 'Phase 1' : (selected.phase === 'phase2' ? 'Phase 2' : 'Final Phase');
    const insight = bestChance === "SAFE"
        ? "Your rank is comfortably within previous cutoff trends."
        : "Your rank is close to previous closing cutoffs and may be achievable depending on phase movement.";

    const distanceScore = Math.abs(studentRank - selected.adjustedCutoff);

    return {
        collegeCode: college.inst_code,
        collegeName: college.name,
        branchCode,
        branchName: branchInfo.name,
        district: college.district,
        cutoff: selected.cutoff,
        adjustedCutoff: selected.adjustedCutoff,
        inflationBuffer: selected.inflationBuffer,
        gap: selected.gap,
        distanceScore,
        phaseSource: phaseNameStr,
        categoryUsed: `${category}_${gender === 'GIRLS' ? 'GIRLS' : 'BOYS'}`,
        chance: bestChance,
        insight,
        fee: college.fee,
        collegeMinCutoff: collegeQualityScore,
        // Backward compatibility
        code: college.inst_code,
        name: college.name,
        branch: branchCode,
        trend: selected.cutoff,
        matchedPhase: phaseNameStr
    };
}

function controlModerateRatio(options, chosenBranches) {
    const safeOptions = options.filter(o => o.chance === "SAFE");
    const moderateOptions = options.filter(o => o.chance === "MODERATE");

    if (moderateOptions.length === 0) {
        return options;
    }

    // Target around 15% - 30% moderate recommendations. Max moderate = safe * 0.35
    const maxModerate = Math.max(3, Math.floor(safeOptions.length * 0.35));
    
    if (moderateOptions.length <= maxModerate) {
        return options;
    }

    // Keep the most realistic ones with the smallest cutoff distance
    moderateOptions.sort((a, b) => a.distanceScore - b.distanceScore);

    const allowedModerate = moderateOptions.slice(0, maxModerate);
    return [...safeOptions, ...allowedModerate];
}

function getGroupOrder(item, chosenBranches) {
    const isPrefBranch = chosenBranches.length === 0 || chosenBranches.includes(item.branchCode);
    if (isPrefBranch) {
        return item.chance === "MODERATE" ? 1 : 2;
    } else {
        return item.chance === "MODERATE" ? 3 : 4;
    }
}

export const RecommendationEngine = {
    generateList(collegesDataset, studentRank, category, gender, phase, chosenBranches, chosenDistricts) {
        collegesDataset.forEach(college => {
            if (college.qualityScore === undefined) {
                college.qualityScore = DatasetParser.getCollegeMinCutoff(college, category, gender);
            }
        });

        let results = [];
        
        // Stage 1: Preferred Districts & Preferred Branches
        collegesDataset.forEach(college => {
            const isPrefDist = chosenDistricts.length === 0 || chosenDistricts.includes(college.district);
            if (!isPrefDist) return;

            Object.keys(college.branches).forEach(bCode => {
                const isPrefBranch = chosenBranches.length === 0 || chosenBranches.includes(bCode);
                if (!isPrefBranch) return;

                const branchInfo = college.branches[bCode];
                const opt = evaluateOption(college, bCode, branchInfo, studentRank, category, gender, phase, college.qualityScore);
                if (opt) {
                    opt.stage = 1;
                    opt.isExpandedSuggestion = false;
                    results.push(opt);
                }
            });
        });

        // Stage 2: Alternative Districts & Preferred Branches
        if (results.length < 15 && chosenDistricts.length > 0) {
            const stage2Results = [];
            collegesDataset.forEach(college => {
                const isPrefDist = chosenDistricts.includes(college.district);
                if (isPrefDist) return;

                Object.keys(college.branches).forEach(bCode => {
                    const isPrefBranch = chosenBranches.length === 0 || chosenBranches.includes(bCode);
                    if (!isPrefBranch) return;

                    const branchInfo = college.branches[bCode];
                    const opt = evaluateOption(college, bCode, branchInfo, studentRank, category, gender, phase, college.qualityScore);
                    if (opt) {
                        opt.stage = 2;
                        opt.isExpandedSuggestion = true;
                        stage2Results.push(opt);
                    }
                });
            });
            results = [...results, ...stage2Results];
        }

        const csItRelated = ["CSE", "CSM", "CSD", "CSC", "CSO", "CIC", "IT", "INF", "ECE"];
        const hasCsItPreference = chosenBranches.some(b => csItRelated.includes(b));

        // Stage 3: Alternative Branches & Preferred Districts
        if (results.length < 15 && chosenBranches.length > 0) {
            const stage3Results = [];
            collegesDataset.forEach(college => {
                const isPrefDist = chosenDistricts.length === 0 || chosenDistricts.includes(college.district);
                if (!isPrefDist) return;

                Object.keys(college.branches).forEach(bCode => {
                    const isPrefBranch = chosenBranches.includes(bCode);
                    if (isPrefBranch) return;

                    if (hasCsItPreference && !csItRelated.includes(bCode)) return;

                    const branchInfo = college.branches[bCode];
                    const opt = evaluateOption(college, bCode, branchInfo, studentRank, category, gender, phase, college.qualityScore);
                    if (opt) {
                        opt.stage = 3;
                        opt.isExpandedSuggestion = true;
                        stage3Results.push(opt);
                    }
                });
            });
            results = [...results, ...stage3Results];
        }

        // Stage 4: Alternative Branches & Alternative Districts
        if (results.length < 15 && chosenBranches.length > 0 && chosenDistricts.length > 0) {
            const stage4Results = [];
            collegesDataset.forEach(college => {
                const isPrefDist = chosenDistricts.includes(college.district);
                if (isPrefDist) return;

                Object.keys(college.branches).forEach(bCode => {
                    const isPrefBranch = chosenBranches.includes(bCode);
                    if (isPrefBranch) return;

                    if (hasCsItPreference && !csItRelated.includes(bCode)) return;

                    const branchInfo = college.branches[bCode];
                    const opt = evaluateOption(college, bCode, branchInfo, studentRank, category, gender, phase, college.qualityScore);
                    if (opt) {
                        opt.stage = 4;
                        opt.isExpandedSuggestion = true;
                        stage4Results.push(opt);
                    }
                });
            });
            results = [...results, ...stage4Results];
        }

        results = controlModerateRatio(results, chosenBranches);

        // Sorting priority:
        // 1. Preferred Branch MODERATE
        // 2. Preferred Branch SAFE
        // 3. Alternative Branch MODERATE
        // 4. Alternative Branch SAFE
        //
        // Within each:
        // - better colleges first (ascending historical cutoff rank)
        // - closer cutoff distance first (distanceScore)
        // - district preference first
        results.sort((a, b) => {
            const aGroup = getGroupOrder(a, chosenBranches);
            const bGroup = getGroupOrder(b, chosenBranches);
            if (aGroup !== bGroup) {
                return aGroup - bGroup;
            }

            if (a.cutoff !== b.cutoff) {
                return a.cutoff - b.cutoff;
            }

            if (a.distanceScore !== b.distanceScore) {
                return a.distanceScore - b.distanceScore;
            }

            const aPrefDist = chosenDistricts.includes(a.district);
            const bPrefDist = chosenDistricts.includes(b.district);
            if (aPrefDist && !bPrefDist) return -1;
            if (!aPrefDist && bPrefDist) return 1;

            return 0;
        });

        return results;
    }
};
