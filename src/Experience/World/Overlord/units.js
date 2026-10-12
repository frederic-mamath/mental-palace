import MeleeMinion from './MeleeMinion.js'
import RangedMinion from './RangedMinion.js'
import Juggernaut from './Juggernaut.js'
import Archer from './Archer.js'

// Overlord's units, by file name: shown on the board and exported to .glb by `npm run export:units`
// (into exports/overlord/). Add a unit here to export it too.
export const units = {
  'melee-minion': MeleeMinion,
  'ranged-minion': RangedMinion,
  juggernaut: Juggernaut,
  archer: Archer,
}
