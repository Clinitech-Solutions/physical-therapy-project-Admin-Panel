import { describe, it, expect } from 'vitest';
import { parsePrintCsv, renderPrintDocument } from './print-document';

describe('saved print document',()=>{
  it('reads full quoted CSV rows with embedded newlines and escaped quotes',()=>{
    expect(parsePrintCsv('\uFEFF"Patient","Notes"\r\n"A, B","line 1\nline ""2"""\r\n')).toEqual([['Patient','Notes'],['A, B','line 1\nline "2"']]);
    expect(()=>parsePrintCsv('"incomplete')).toThrow();
  });
  it('escapes saved text and gives long instructions room to flow over A4 pages',()=>{
    const html=renderPrintDocument({title:'<script>alert(1)</script>',sections:[{title:'Notes',fields:[['Saved instructions','Long instructions '.repeat(200)]]}]},{name:'Clinic & Center'},'ar-EG');
    expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('dir="rtl"');expect(html).toContain('size:A4 portrait');
    expect(html).toContain('class="long-text"');expect(html).toContain('table-header-group');
    expect(html).toContain('Africa/Cairo');
  });
});
