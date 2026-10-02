import warehousePhoto from './warehouse-realistic.webp';

/** Decorative photo with a slow camera drift; report state stays independent. */
export default function WarehouseScene({ paused }: { paused: boolean }) {
  return <div className={`warehouse-scene ${paused ? 'is-paused' : ''}`} aria-hidden="true">
    <img className="warehouse-photo" src={warehousePhoto} alt="" width="1920" height="820" decoding="async"/>
    <div className="warehouse-scene-shade"/>
  </div>;
}
