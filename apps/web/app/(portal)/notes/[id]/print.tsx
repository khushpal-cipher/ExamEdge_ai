'use client';

// "Download as PDF" = the browser's print dialog (Save as PDF); print CSS hides the portal around the notes (ADR-039).
export function PrintButton() {
  return (
    <button type="button" className="no-print" onClick={() => window.print()}>
      Download as PDF
    </button>
  );
}
