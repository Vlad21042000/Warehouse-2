import warehouseAisle from './warehouse-aisle.webp';

/** Static decorative background spanning the entire viewport. */
export default function WarehouseScene() {
  return <div className="warehouse-scene" aria-hidden="true">
    <img className="warehouse-photo" src={warehouseAisle} alt="" width="2172" height="724" decoding="async"/>
    <div className="warehouse-scene-shade"/>
  </div>;
}
