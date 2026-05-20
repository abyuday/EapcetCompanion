export const DatasetParser = {
    normalizeCollegeName(name) {
        if (!name) return "";
        return name.trim().replace(/\s+/g, " ").toUpperCase();
    },

    normalizeBranchName(name) {
        if (!name) return "";
        return name.trim().replace(/\s+/g, " ").toUpperCase();
    },

    normalizeCategory(category) {
        if (!category) return "OC";
        return category.trim().toUpperCase();
    },

    getExactCutoff(cutoffsObj, category, gender) {
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
    },

    getCollegeMinCutoff(college, category, gender) {
        let minCutoff = 999999;
        if (!college.branches) return minCutoff;
        
        Object.keys(college.branches).forEach(bCode => {
            const branch = college.branches[bCode];
            if (branch.cutoffs && branch.cutoffs.phase1) {
                const val = this.getExactCutoff(branch.cutoffs.phase1, category, gender);
                if (val && val < minCutoff) {
                    minCutoff = val;
                }
            }
        });
        return minCutoff;
    }
};
