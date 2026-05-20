import XLSX from 'xlsx';
import fs from 'fs';

const DISTRICT_MAP = {
  'HYD': 'Hyderabad',
  'RR': 'Rangareddy',
  'MDL': 'Medchal-Malkajgiri',
  'WGL': 'Warangal',
  'HNK': 'Warangal',
  'MED': 'Medak',
  'SRD': 'Sangareddy',
  'JTL': 'Jagtial',
  'PDL': 'Peddapalli',
  'SRC': 'Sircilla',
  'YBG': 'Yadadri Bhuvanagiri',
  'KRM': 'Karimnagar',
  'WNP': 'Wanaparthy',
  'SRP': 'Suryapet',
  'KGM': 'Bhadradri Kothagudem',
  'KHM': 'Khammam',
  'MHB': 'Mahabubabad',
  'SDP': 'Siddipet',
  'MBN': 'Mahabubnagar',
  'KMR': 'Kamareddy',
  'NZB': 'Nizamabad',
  'NLG': 'Nalgonda',
  'NPT': 'Narayanpet'
};

const KNOWN_FEES = {
  'JNTH': '₹50,000',
  'OUCE': '₹35,000',
  'CBIT': '₹1,40,000',
  'VASV': '₹1,30,000',
  'VNRT': '₹1,35,000',
  'KMIT': '₹1,15,000',
  'CVRH': '₹1,15,000',
  'MGIT': '₹1,08,000',
  'GRIET': '₹1,22,000',
  'IARE': '₹90,000',
  'BVRH': '₹1,20,000',
  'STAN': '₹78,000',
  'CMRK': '₹1,00,000',
  'VMTW': '₹85,000',
  'KUEW': '₹45,000',
  'VJYA': '₹70,000'
};

const files = [
  { name: 'TGEAPCET_2025_LASTRANKS_FirstPhase.xlsx', phase: 'phase1', sheets: ['Table 1'] },
  { name: 'TGEAPCET_2025_LASTRANKS_SecondPhase.xlsx', phase: 'phase2', sheets: ['Table 1'] },
  { name: 'TGEAPCET_2025_FINALPHASE_LASTRANKS (1).xlsx', phase: 'finalPhase', sheets: ['Table 1'] }
];

const branches = {};
const colleges = {};
const districts = {};

// Hardcoded header indices for standard format (based on row 1 of Table 1)
const HEADER_COLS = [
  'Inst Code',     'Institute Name',
  'Place',         'Dist Code',
  'Co Education',  'College Type',
  'Branch Code',   'Branch Name',
  'OC BOYS',       'OC GIRLS',
  'BC_A BOYS',     'BC_A GIRLS',
  'BC_B BOYS',     'BC_B GIRLS',
  'BC_C BOYS',     'BC_C GIRLS',
  'BC_D BOYS',     'BC_D GIRLS',
  'BC_E BOYS',     'BC_E GIRLS',
  'SC_I BOYS',     'SC_I GIRLS',
  'SC_II BOYS',    'SC_II GIRLS',
  'SC_III BOYS',   'SC_III GIRLS',
  'ST BOYS',       'ST GIRLS',
  'EWS BOYS',      'EWS GIRLS',
  'Affiliated To'
];

// Clean category header name to standard key format: e.g. "OC BOYS" -> "OC_BOYS"
function cleanKey(key) {
  return key.trim().replace(/\s+/g, '_');
}

for (const fileInfo of files) {
  console.log(`Processing file: ${fileInfo.name} for ${fileInfo.phase}...`);
  if (!fs.existsSync(fileInfo.name)) {
    console.error(`File ${fileInfo.name} does not exist!`);
    continue;
  }
  const workbook = XLSX.readFile(fileInfo.name);
  
  for (const sheetName of fileInfo.sheets) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.warn(`Sheet ${sheetName} not found in ${fileInfo.name}`);
      continue;
    }
    
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const hasHeader = !(fileInfo.name.includes('SecondPhase') && sheetName === 'Table 2');
    const startRow = hasHeader ? 2 : 0;
    
    // In case we have headers, we can map dynamically by indices
    let colIndices = {};
    if (hasHeader) {
      const headerRow = data[1];
      if (!headerRow) continue;
      headerRow.forEach((colName, index) => {
        if (colName) {
          // Normalize column names
          let normalized = colName.toString().trim().replace(/\s+/g, ' ');
          if (normalized === 'Co Educatio n') normalized = 'Co Education';
          colIndices[normalized] = index;
        }
      });
    } else {
      // Map based on default indices of standard header format
      HEADER_COLS.forEach((colName, index) => {
        colIndices[colName] = index;
      });
    }
    
    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length < 8) continue;
      
      const getVal = (colName) => {
        const idx = colIndices[colName];
        return idx !== undefined ? row[idx] : undefined;
      };
      
      const instCode = getVal('Inst Code');
      const instName = getVal('Institute Name');
      const place = getVal('Place');
      const distCode = getVal('Dist Code');
      const coEducation = getVal('Co Education') || 'COED';
      const collegeType = getVal('College Type') || 'PVT';
      const branchCode = getVal('Branch Code');
      const branchName = getVal('Branch Name');
      const affiliatedTo = getVal('Affiliated To');
      
      if (!instCode || !branchCode || instCode.toString().trim() === 'Inst Code' || branchCode.toString().trim() === 'Branch Code') continue;
      
      // 1. Process Branch details
      const cleanedBranchCode = branchCode.toString().trim();
      const cleanedBranchName = branchName ? branchName.toString().trim() : cleanedBranchCode;
      
      if (!branches[cleanedBranchCode]) {
        branches[cleanedBranchCode] = {
          code: cleanedBranchCode,
          name: cleanedBranchName
        };
      }
      
      // 2. Process District details
      const cleanedDistCode = distCode ? distCode.toString().trim() : 'UNK';
      const friendlyDistName = DISTRICT_MAP[cleanedDistCode] || cleanedDistCode;
      if (!districts[cleanedDistCode]) {
        districts[cleanedDistCode] = friendlyDistName;
      }
      
      // 3. Process College details
      const cleanedInstCode = instCode.toString().trim();
      if (!colleges[cleanedInstCode]) {
        let feeVal = KNOWN_FEES[cleanedInstCode];
        if (!feeVal) {
          feeVal = (collegeType.toString().trim() === 'UNIV' ? '₹35,000' : '₹90,000');
        }
        colleges[cleanedInstCode] = {
          inst_code: cleanedInstCode,
          name: instName ? instName.toString().trim() : cleanedInstCode,
          place: place ? place.toString().trim() : '',
          dist_code: cleanedDistCode,
          district: friendlyDistName,
          type: collegeType ? collegeType.toString().trim() : 'PVT',
          coed: coEducation ? coEducation.toString().trim() : 'COED',
          affiliated_to: affiliatedTo ? affiliatedTo.toString().trim() : '',
          fee: feeVal,
          branches: {}
        };
      }
      
      // Ensure branch exists under college
      if (!colleges[cleanedInstCode].branches[cleanedBranchCode]) {
        colleges[cleanedInstCode].branches[cleanedBranchCode] = {
          code: cleanedBranchCode,
          name: cleanedBranchName,
          cutoffs: {}
        };
      }
      
      // 4. Process Cutoff ranks
      const cutoffsObj = {};
      const categoryColumns = [
        'OC BOYS', 'OC GIRLS',
        'BC_A BOYS', 'BC_A GIRLS',
        'BC_B BOYS', 'BC_B GIRLS',
        'BC_C BOYS', 'BC_C GIRLS',
        'BC_D BOYS', 'BC_D GIRLS',
        'BC_E BOYS', 'BC_E GIRLS',
        'SC_I BOYS', 'SC_I GIRLS',
        'SC_II BOYS', 'SC_II GIRLS',
        'SC_III BOYS', 'SC_III GIRLS',
        'ST BOYS', 'ST GIRLS',
        'EWS BOYS', 'EWS GIRLS'
      ];
      
      categoryColumns.forEach(catCol => {
        const rawRank = getVal(catCol);
        if (rawRank !== undefined && rawRank !== null && rawRank !== '') {
          const parsedRank = parseInt(rawRank);
          if (!isNaN(parsedRank) && parsedRank > 0) {
            cutoffsObj[cleanKey(catCol)] = parsedRank;
          }
        }
      });
      
      colleges[cleanedInstCode].branches[cleanedBranchCode].cutoffs[fileInfo.phase] = cutoffsObj;
    }
  }
}

// Convert structures to arrays for client JSON representation
const outputData = {
  districts: Object.entries(districts).map(([code, name]) => ({ code, name })),
  branches: Object.values(branches).sort((a, b) => a.code.localeCompare(b.code)),
  colleges: colleges // keeps as map for easy lookup or we can convert it to map representation
};

fs.writeFileSync('public/counselling_data.json', JSON.stringify(outputData, null, 2));
console.log(`Successfully processed counselling data. Written to public/counselling_data.json.`);
console.log(`Total branches extracted: ${Object.keys(branches).length}`);
console.log(`Total colleges extracted: ${Object.keys(colleges).length}`);
