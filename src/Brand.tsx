export function BrandMark({ className = '' }: { className?: string }) {
  return <img className={`vs-logo ${className}`} src="/vs-logo.png" width={48} height={48} alt="" aria-hidden="true" decoding="async" />;
}

export function BrandWordmark() {
  return <span className="brand-wordmark"><span className="brand-name"><b>VS</b> Warehouse</span><span className="brand-sub">REPORTING</span></span>;
}
