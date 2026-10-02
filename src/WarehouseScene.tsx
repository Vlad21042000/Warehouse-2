import { useEffect, useState } from 'react';
import warehouseAisle from './warehouse-aisle.webp';
import workerWalk from './warehouse-worker-walk.webp';
import forkliftLift from './warehouse-forklift-lift.webp';

/** Independent decorative sprite scene; no timers or report-state updates. */
export default function WarehouseScene({ paused }: { paused: boolean }) {
  const [inactive, setInactive] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setInactive(document.hidden || motion.matches);
    update();
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
    };
  }, []);

  return <div className={`warehouse-scene ${paused || inactive ? 'is-paused' : ''}`} aria-hidden="true">
    <div className="warehouse-stage">
      <img className="warehouse-photo" src={warehouseAisle} alt="" width="2172" height="724" decoding="async"/>
      <div className="warehouse-worker-route worker-far">
        <div className="warehouse-worker-facing">
          <div className="warehouse-worker-sprite" style={{ backgroundImage: `url(${workerWalk})` }}/>
        </div>
      </div>
      <div className="warehouse-forklift-route">
        <div className="warehouse-forklift-sprite" style={{ backgroundImage: `url(${forkliftLift})` }}/>
        <span className="warehouse-beacon"/>
      </div>
      <div className="warehouse-worker-route worker-near">
        <div className="warehouse-worker-sprite" style={{ backgroundImage: `url(${workerWalk})` }}/>
      </div>
    </div>
    <div className="warehouse-scene-shade"/>
  </div>;
}
