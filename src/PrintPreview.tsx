import { useLayoutEffect, useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import PrintReport from './PrintReport';
import type { Dataset, Report } from './report';
type Props = {open: boolean; onClose: () => void; report: Report; dataset: Dataset; paper: 'Letter' | 'A4'; onPaper: (paper: 'Letter' | 'A4') => void};
export default function PrintPreview({open, onClose, report, dataset, paper, onPaper}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState('page');
  const [available, setAvailable] = useState({width:800, height:700});
  const width = paper === 'Letter' ? 816 : 210 / 25.4 * 96;
  const height = paper === 'Letter' ? 1056 : 297 / 25.4 * 96;
  const scale = zoom === 'page' || zoom === 'fit' ? Math.max(0.01, Math.min(1, (available.width - 32) / width, zoom === 'page' ? (available.height - 32) / height : 1)) : Number(zoom) / 100;
  useLayoutEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setAvailable({width:entry.contentRect.width, height:entry.contentRect.height}));
    observer.observe(viewport.current);
    const element = content.current?.querySelector<HTMLElement>('.print-document');
    if (element) {
      element.style.zoom = '1';
      const measured = element.scrollHeight;
      const usable = height - 144;
      if (measured > 0) element.style.zoom = String(Math.min(1, (usable - 4) / measured));
    }
    return () => observer.disconnect();
  }, [open, paper, report, height]);
  function print() { onClose(); dialog.current?.close(); requestAnimationFrame(() => window.print()); }
  return <dialog ref={dialog} className="print-preview-dialog" aria-labelledby="preview-title" onCancel={onClose} onClose={onClose}>
    <div className="preview-heading"><div><h2 id="preview-title">Print preview</h2><p>One sheet · {report.employees.length} rows · {dataset.sample ? 'Sample data' : 'Your report'}</p></div><button className="icon-button" aria-label="Close print preview" onClick={onClose}><X size={20}/></button></div>
    <div className="preview-toolbar"><label>Paper<select aria-label="Preview paper size" value={paper} onChange={event => onPaper(event.target.value as 'Letter' | 'A4')}><option value="Letter">Letter · 8.5 × 11 in</option><option value="A4">A4 · 210 × 297 mm</option></select></label><label>Zoom<select aria-label="Preview zoom" value={zoom} onChange={event => setZoom(event.target.value)}><option value="page">Fit page</option><option value="fit">Fit width</option>{[50,75,100,125,150].map(value => <option key={value} value={value}>{value}%</option>)}</select></label><button className="button primary" onClick={print}><Printer size={16}/>Print / Save PDF</button></div>
    <p className="preview-note">Includes every employee and system account on the selected day. Search filters do not affect printing. In the print dialog, choose the same paper size and turn off browser headers and footers.</p>
    <div className="preview-viewport" ref={viewport}>{open && <div className="preview-sheet-container" style={{width: width * scale, height: height * scale}}><div className="preview-sheet" style={{width, height, transform: `scale(${scale})`}}><div ref={content}><PrintReport report={report} dataset={dataset} paper={paper}/></div></div></div>}</div>
  </dialog>;
}
