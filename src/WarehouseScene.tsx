/** Decorative warehouse scene. Motion is CSS-only and never touches report state. */
export default function WarehouseScene({ paused }: { paused: boolean }) {
  return <div className={`warehouse-scene ${paused ? 'is-paused' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id="warehouse-floor" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#29251e"/><stop offset="1" stopColor="#121315"/></linearGradient>
        <linearGradient id="warehouse-box" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d49a49"/><stop offset="1" stopColor="#795c32"/></linearGradient>
        <pattern id="warehouse-grid" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="skewX(-25)"><path d="M90 0H0V90" fill="none" stroke="#99815c" strokeWidth="1"/></pattern>
        <g id="warehouse-carton"><rect width="44" height="34" rx="2" fill="url(#warehouse-box)"/><path d="M22 0V34M0 9H44" stroke="#efc787" strokeWidth="2"/><rect x="29" y="18" width="10" height="8" fill="#ead8b8"/></g>
        <g id="warehouse-person">
          <g className="worker-body"><circle cx="0" cy="-52" r="10" fill="#e2b890"/><path d="M-12-56Q0-76 12-56Z" fill="#ffd27c"/><rect x="-13" y="-39" width="26" height="36" rx="7" fill="#f4b64c"/><path d="M-9-33L9-8M9-33L-9-8" stroke="#fff0b9" strokeWidth="3"/>
            <path className="worker-arm worker-arm-left" d="M-12-31L-22-9" stroke="#d4b18e" strokeWidth="7" strokeLinecap="round"/>
            <path className="worker-arm worker-arm-right" d="M12-31L22-9" stroke="#d4b18e" strokeWidth="7" strokeLinecap="round"/>
          </g>
          <path className="worker-leg worker-leg-left" d="M-7-4L-10 23" stroke="#7794a9" strokeWidth="9" strokeLinecap="round"/>
          <path className="worker-leg worker-leg-right" d="M7-4L10 23" stroke="#7794a9" strokeWidth="9" strokeLinecap="round"/>
        </g>
      </defs>
      <rect width="1440" height="900" fill="#151719"/>
      <path d="M0 300H1440V900H0Z" fill="url(#warehouse-floor)"/>
      <path d="M0 350H1440V900H0Z" fill="url(#warehouse-grid)" opacity=".35"/>
      <g fill="none" stroke="#776d59" strokeWidth="3" opacity=".65"><path d="M0 20H1440M0 100H1440M160 0V110M720 0V110M1280 0V110"/><path d="M0 160L720 20L1440 160"/></g>
      {[170, 610, 1050].map((x, index) => <g key={x} transform={`translate(${x} 115)`}>
        <rect x="-12" y="-10" width="275" height="228" rx="5" fill="#24282b"/>
        <g stroke="#8b969b" strokeWidth="7" fill="none"><path d="M0 0V220M250 0V220M0 10H250M0 80H250M0 150H250M0 220H250"/><path d="M0 10L250 220M250 10L0 220" opacity=".25"/></g>
        {[25, 95, 165].map(y => <g key={y}>{[14, 64, 114, 164, 204].map((box, i) => <use key={box} href="#warehouse-carton" x={box} y={y} opacity={.65 + ((index + i) % 3) * .15}/>)}</g>)}
        <rect x="87" y="-20" width="70" height="22" rx="3" fill="#b48236"/><text x="122" y="-5" textAnchor="middle" fill="#ffe0a5" fontSize="12" fontFamily="sans-serif">{['A-01','B-02','C-03'][index]}</text>
      </g>)}
      <g transform="translate(80 540)"><path d="M0 0H1280" stroke="#9e7837" strokeWidth="6" strokeDasharray="28 20"/><path d="M0 150H1280" stroke="#9e7837" strokeWidth="6" strokeDasharray="28 20"/></g>
      <g transform="translate(700 395)"><ellipse cy="28" rx="32" ry="8" fill="#000" opacity=".4"/><g className="warehouse-picker"><use href="#warehouse-person"/><g className="picker-box"><use href="#warehouse-carton" x="12" y="-40" transform="scale(.65)"/></g></g></g>
      <g transform="translate(180 450)"><g className="warehouse-walker"><ellipse cy="28" rx="33" ry="8" fill="#000" opacity=".4"/><use href="#warehouse-person"/></g></g>
      <g transform="translate(1050 770)"><g className="warehouse-walker warehouse-walker-return"><ellipse cy="28" rx="33" ry="8" fill="#000" opacity=".4"/><use href="#warehouse-person"/><use href="#warehouse-carton" x="8" y="-32" transform="scale(.65)"/></g></g>
      <g transform="translate(90 615)"><g className="warehouse-forklift">
        <ellipse cx="65" cy="47" rx="88" ry="14" fill="#000" opacity=".4"/>
        <path d="M-15 5H55L75 26H104V43H-15Z" fill="#e2a543"/>
        <path d="M10 4V-63H75V15M12-63H77" fill="none" stroke="#a9b4ba" strokeWidth="6"/>
        <rect x="18" y="-27" width="18" height="27" rx="4" fill="#6e8293"/>
        <circle cx="32" cy="-41" r="9" fill="#deb58a"/><path d="M22-45Q32-60 43-45Z" fill="#ffd27c"/>
        <path d="M39-26L58-12" stroke="#e4b44d" strokeWidth="9" strokeLinecap="round"/><path d="M52-19L62-7" stroke="#bcc5ca" strokeWidth="3"/>
        <path d="M100-65V42H151" fill="none" stroke="#bac4ca" strokeWidth="6"/><use href="#warehouse-carton" x="110" y="4"/>
        <circle cx="7" cy="39" r="16" fill="#11171c" stroke="#9ca9ad" strokeWidth="5"/><circle cx="83" cy="39" r="16" fill="#11171c" stroke="#9ca9ad" strokeWidth="5"/>
        <circle className="forklift-beacon" cx="43" cy="-68" r="5" fill="#ffca69"/>
      </g></g>
      <g transform="translate(220 840)"><rect width="1040" height="25" rx="10" fill="#566168"/>{Array.from({length:26},(_,i)=><circle key={i} cx={20+i*40} cy="13" r="10" fill="#313c42" stroke="#a1a29a"/>)}<g className="warehouse-conveyor"><use href="#warehouse-carton" x="0" y="-35"/><use href="#warehouse-carton" x="160" y="-35"/><use href="#warehouse-carton" x="320" y="-35"/><use href="#warehouse-carton" x="480" y="-35"/><use href="#warehouse-carton" x="640" y="-35"/></g></g>
    </svg>
    <div className="warehouse-scene-shade"/>
  </div>;
}
