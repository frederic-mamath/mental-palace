// What an interaction zone offers, shown by its ring so visitors know before stepping in. Two cues, so it
// also reads for colour-blind visitors who may not tell red from orange:
// - travel (a vehicle to another island): red, dashed ring with the dashes slowly rotating
// - experience (a project or story to view in detail): orange, solid ring pulsing inward
// Every landmark picks one of these kinds rather than its own ring color.
export const interactionKinds = {
  travel: { color: '#e23b3b', ringStyle: 'dashed' },
  experience: { color: '#f5a524', ringStyle: 'solid' },
}
