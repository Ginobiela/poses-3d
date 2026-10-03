/** Degrees. Bend uses three joint centers; local-axis uses a calibrated rest-local axis. */
export type CorrectiveMeasurement =
  | Readonly<{ type: 'bend'; boneA: string; boneB: string; boneC: string }>
  | Readonly<{
    type: 'local-axis'; bone: string;
    axis: readonly [number, number, number];
    restQuaternion: readonly [number, number, number, number];
    direction: 1 | -1;
  }>;

export type PoseCorrective = Readonly<{
  id: string;
  joint: string;
  morph: string;
  measurement: CorrectiveMeasurement;
  startAngle: number;
  fullAngle: number;
}>;

// MODEL_AUDIT.md: none of the 306 targets is an identified joint corrective.
// Add only authored, inspected correctives; bodyMuscular/armsMuscular are body shapes.
export const POSE_CORRECTIVES: readonly PoseCorrective[] = Object.freeze([]);
