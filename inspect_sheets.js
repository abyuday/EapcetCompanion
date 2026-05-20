import XLSX from 'xlsx';
import fs from 'fs';

const files = [
  'TGEAPCET_2025_LASTRANKS_FirstPhase.xlsx',
  'TGEAPCET_2025_LASTRANKS_SecondPhase.xlsx',
  'TGEAPCET_2025_FINALPHASE_LASTRANKS (1).xlsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const wb = XLSX.readFile(f);
    printInfo(f, wb);
  } else {
    console.log(`${f} does not exist!`);
  }
});

function printInfo(name, wb) {
  console.log(`=== FILE: ${name} ===`);
  console.log("Sheets:", wb.SheetNames);
  wb.SheetNames.forEach(sheet => {
    const ws = wb.Sheets[sheet];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Sheet "${sheet}": total rows = ${data.length}`);
    if (data.length > 0) {
      console.log("Row 0:", data[0].slice(0, 10));
    }
    if (data.length > 1) {
      console.log("Row 1:", data[1].slice(0, 10));
    }
  });
}
