// Minimal PDF writer for test fixtures and demo notes (no dependency). One array of lines per page; `null` = a page
// with no text layer (a stand-in for a scanned page). ASCII lines use Helvetica; other lines (Hindi, formula symbols)
// use a Type0 font with an identity ToUnicode map, so text extraction works even though no glyphs are embedded.
export function makePdf(pages: (string[] | null)[]): Buffer {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) + 2; // object numbers start after catalog (1) and pages (2)
  const stream = (s: string) => add(`<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`);

  const ranges = Array.from({ length: 256 }, (_, i) => {
    const h = i.toString(16).padStart(2, '0').toUpperCase();
    return `<${h}00> <${h}FF> <${h}00>`;
  });
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Identity def /CMapType 2 def
1 begincodespacerange <0000> <FFFF> endcodespacerange
256 beginbfrange
${ranges.join('\n')}
endbfrange endcmap CMapName currentdict /CMap defineresource pop end end`;
  const helv = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const toUni = stream(cmap);
  const desc = add(
    '<< /Type /FontDescriptor /FontName /Fallback /Flags 32 /FontBBox [0 -200 1000 900] /ItalicAngle 0 ' +
      '/Ascent 900 /Descent -200 /CapHeight 700 /StemV 80 >>',
  );
  const cid = add(
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Fallback /CIDSystemInfo << /Registry (Adobe) ' +
      `/Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity >>`,
  );
  const uni = add(
    `<< /Type /Font /Subtype /Type0 /BaseFont /Fallback /Encoding /Identity-H /DescendantFonts [${cid} 0 R] ` +
      `/ToUnicode ${toUni} 0 R >>`,
  );

  const kids = pages.map((lines) => {
    const ops = lines
      ? [
          'BT 50 790 Td 16 TL',
          ...lines.map((l) =>
            /^[\x20-\x7e]*$/.test(l)
              ? `/F1 11 Tf (${l.replace(/[\\()]/g, '\\$&')}) Tj T*`
              : `/F2 11 Tf <${[...l].map((c) => c.codePointAt(0)!.toString(16).padStart(4, '0')).join('')}> Tj T*`,
          ),
          'ET',
        ]
      : ['0.85 g 50 300 495 450 re f'];
    const content = stream(ops.join('\n'));
    return add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${content} 0 R ` +
        `/Resources << /Font << /F1 ${helv} 0 R /F2 ${uni} 0 R >> >> >>`,
    );
  });

  const all = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`,
    ...objects,
  ];
  let out = '%PDF-1.7\n';
  const offsets = all.map((body, i) => {
    const at = Buffer.byteLength(out, 'latin1');
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${all.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${all.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
