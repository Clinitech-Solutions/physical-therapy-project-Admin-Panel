export type PrintValue = string | number | null | undefined;
export interface PrintSection {
  title: string;
  fields?: [string, PrintValue][];
  paragraphs?: string[];
  columns?: string[];
  rows?: PrintValue[][];
  totals?: [string, PrintValue][];
}
export interface PrintDocument {
  title: string;
  subtitle?: string;
  scope?: string[];
  landscape?: boolean;
  sections: PrintSection[];
}

export const PRINT_ROW_LIMIT = 5000;
export const escapePrint = (value: PrintValue): string => String(value ?? '—')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** RFC 4180, including BOM, embedded newlines, commas and escaped quotes. */
export function parsePrintCsv(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  source = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else throw new Error('Malformed CSV');
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Malformed CSV');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export const PRINT_STYLES = `
@page{size:A4 portrait;margin:11mm}
*{box-sizing:border-box}html{color-scheme:light;background:white;color:#172c35}
body{margin:0;font:10pt/1.45 Arial,Tahoma,sans-serif;background:#fff;color:#172c35}
header{border-bottom:1.5pt solid #157e87;padding-bottom:4mm;margin-bottom:4mm}
h1{font-size:18pt;line-height:1.2;margin:2mm 0;color:#125c68}h2{font-size:12pt;color:#125c68;margin:5mm 0 2mm;break-after:avoid}
p{margin:1.5mm 0;white-space:pre-wrap;overflow-wrap:anywhere}small{font-size:9pt}
.clinic{font-size:13pt;font-weight:bold}.contact{font-size:9pt}.scope{font-size:9pt}
table{border-collapse:collapse;width:100%;table-layout:fixed;margin:2mm 0 3mm;font-size:9.5pt}
thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid}
th,td{border:0.5pt solid #b6c7cd;padding:1.8mm;vertical-align:top;text-align:start;overflow-wrap:anywhere;white-space:pre-wrap}
th{background:#edf5f6;font-weight:bold;color:#163e49}td.numeric{font-variant-numeric:tabular-nums;text-align:end;white-space:normal}
dl{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 5mm;margin:2mm 0 3mm}
dl>div{break-inside:avoid;min-width:0}dl>div.long-text{grid-column:1/-1;break-inside:auto}dt{font-size:9pt;color:#334e59;font-weight:bold}dd{margin:0;padding-inline-end:1mm;white-space:pre-wrap;overflow-wrap:anywhere}
.totals{border-top:1pt solid #577b86;padding-top:2mm;break-inside:avoid}
.empty{font-style:italic}.record{border-top:0.5pt solid #b6c7cd;padding-top:2mm}
@media print{html,body{width:auto!important;min-width:0!important;height:auto!important;max-height:none!important;overflow:visible!important;background:white!important;color:#172c35!important}button,input,select,textarea,nav,[role=tooltip]{display:none!important}a{color:inherit;text-decoration:none}}
`;

export function renderPrintDocument(model: PrintDocument, clinic: {name:string;phone?:string|null;address?:string|null;email?:string|null}, language: string): string {
  const esc = escapePrint, ar = language.startsWith('ar');
  const fields = (pairs: [string, PrintValue][], total = false) => `<dl${total ? ' class="totals"' : ''}>${pairs.map(([label,value]) => `<div${String(value??'').length>280?' class="long-text"':''}><dt>${esc(label)}</dt><dd dir="auto">${esc(value)}</dd></div>`).join('')}</dl>`;
  const timestamp = new Intl.DateTimeFormat(language,{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date());
  return `<!doctype html><html lang="${ar?'ar':'en'}" dir="${ar?'rtl':'ltr'}"><head><meta charset="utf-8"><title>${esc(model.title)}</title><style>${PRINT_STYLES}${model.landscape?'@page{size:A4 landscape}':''}</style></head><body>
  <header><div class="clinic" dir="auto">${esc(clinic.name)}</div>${[clinic.phone,clinic.address,clinic.email].filter(Boolean).map(v=>`<p class="contact" dir="auto">${esc(v)}</p>`).join('')}
  <h1>${esc(model.title)}</h1>${model.subtitle?`<p dir="auto">${esc(model.subtitle)}</p>`:''}<small>${ar?'تاريخ الإنشاء':'Generated'}: ${esc(timestamp)} · Africa/Cairo</small>
  ${(model.scope??[]).map(v=>`<p class="scope" dir="auto">${esc(v)}</p>`).join('')}</header>
  <main>${model.sections.map(s=>`<section><h2>${esc(s.title)}</h2>${s.fields?fields(s.fields):''}${(s.paragraphs??[]).map(p=>`<p dir="auto">${esc(p)}</p>`).join('')}
  ${s.columns?`<table>${s.columns[0]==="Row" || s.columns[0]==="\u0627\u0644\u0633\u062c\u0644"?'<colgroup><col style="width:5%">'+s.columns.slice(1).map(()=>'<col>').join('')+'</colgroup>':''}<thead><tr>${s.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${s.rows?.length?s.rows.map(r=>`<tr>${r.map(v=>`<td dir="auto"${typeof v==='number'||/^-?\d+([.,]\d+)?$|EGP|\u062c\.?\u0645/.test(String(v??''))?' class="numeric"':''}>${esc(v)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${s.columns.length}" class="empty">${ar?'لا توجد بيانات مطابقة':'No matching records'}</td></tr>`}</tbody></table>`:''}${s.totals?fields(s.totals,true):''}</section>`).join('')}</main></body></html>`;
}
