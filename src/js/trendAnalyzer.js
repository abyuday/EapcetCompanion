import { DatasetParser } from './datasetParser.js';

export const TrendAnalyzer = {
    analyzeTrend(college, branchCode, branchInfo, category, gender) {
        const p1 = DatasetParser.getExactCutoff(branchInfo.cutoffs.phase1, category, gender);
        const p2 = DatasetParser.getExactCutoff(branchInfo.cutoffs.phase2, category, gender);
        const pf = DatasetParser.getExactCutoff(branchInfo.cutoffs.finalPhase, category, gender);

        let trendBadge = "Stable Trend";
        let trendExplanation = "This option shows stable historical trends based on available benchmarks.";

        const representativeCutoff = pf || p2 || p1 || 999999;

        if (p1 && pf) {
            const diffPercent = ((pf - p1) / p1) * 100;
            if (diffPercent >= 12) {
                trendBadge = "Expanding Trend";
                trendExplanation = `Cutoffs expanded by ${Math.round(diffPercent)}% in later phases (Phase 1: ${p1.toLocaleString()} to Final: ${pf.toLocaleString()}), meaning seats became easier to secure.`;
            } else if (diffPercent <= -6) {
                trendBadge = "Competitive Spike";
                trendExplanation = `Cutoffs became tougher by ${Math.round(Math.abs(diffPercent))}% in final phases (Phase 1: ${p1.toLocaleString()} to Final: ${pf.toLocaleString()}), indicating high competition.`;
            } else if (Math.abs(diffPercent) < 6) {
                trendBadge = "Stable Trend";
                trendExplanation = `Cutoffs remained highly stable across phases (Phase 1: ${p1.toLocaleString()} vs Final: ${pf.toLocaleString()}), indicating predictable and consistent demand.`;
            }
        } else if (representativeCutoff < 5000) {
            trendBadge = "High Demand";
            trendExplanation = "This option is in consistently high demand, with very competitive cutoff ranks.";
        }

        return {
            trendBadge,
            trendExplanation,
            phaseMovement: { p1, p2, pf }
        };
    }
};
