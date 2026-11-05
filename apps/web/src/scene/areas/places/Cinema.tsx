import { AREA } from '../../../world/places/cinema';
import { AreaGroup, Ground } from '../kit';

/** Cinema: placeholder yard (to be built). */
export default function Cinema() {
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#b9d98f" y={0.006} />
    </AreaGroup>
  );
}
