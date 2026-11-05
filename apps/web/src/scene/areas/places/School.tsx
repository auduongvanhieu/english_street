import { AREA } from '../../../world/places/school';
import { AreaGroup, Ground } from '../kit';

/** School: placeholder yard (to be built). */
export default function School() {
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#b9d98f" y={0.006} />
    </AreaGroup>
  );
}
