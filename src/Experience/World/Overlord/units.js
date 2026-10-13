import MeleeMinion from './MeleeMinion.js'
import CasterMinion from './CasterMinion.js'
import Juggernaut from './Juggernaut.js'
import ArcherMinion from './ArcherMinion.js'

// Overlord's units, by file name: shown on the board and exported to .glb by `npm run export:units`
// (into exports/overlord/). Add a unit here to export it too.
export const units = {
  'melee-minion': MeleeMinion,
  'caster-minion': CasterMinion,
  juggernaut: Juggernaut,
  'archer-minion': ArcherMinion,
}
