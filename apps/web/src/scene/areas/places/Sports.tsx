import { AREA } from '../../../world/places/sports';
import { AreaGroup, Ground } from '../kit';

/** Sports: placeholder yard (to be built). */
export default function Sports() {
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#b9d98f" y={0.006} />
    </AreaGroup>
  );
}
