"""Validate all browser-ready poses and their catalogue metadata."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSES = ROOT / 'public/poses'
REQUIRED = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']
for side in ('Left', 'Right'):
    REQUIRED += [side + part for part in ('Shoulder', 'Arm', 'ForeArm', 'Hand',
                                          'UpLeg', 'Leg', 'Foot', 'ToeBase')]


def check(condition, message):
    if not condition:
        raise ValueError(message)


manifest = json.loads((POSES / 'manifest.json').read_text(encoding='utf-8'))
check(manifest['skeleton'] == 'mixamorig', 'manifest skeleton must be mixamorig')
check(len(manifest['poses']) == 20, 'expected 20 migrated poses')
check(len({entry['id'] for entry in manifest['poses']}) == 20, 'duplicate pose IDs')
for entry in manifest['poses']:
    check(entry['license'] == 'CC0-1.0' and entry['skeletonSource'] == 'Quaternius UAL'
          and entry['retargetedTo'] == 'mixamorig', f"{entry['id']}: provenance metadata")
    path = (POSES / entry['file']).resolve()
    check(path.is_relative_to(POSES.resolve()), f'{path}: outside poses directory')
    pose = json.loads(path.read_text(encoding='utf-8'))
    check(pose['category'] == entry['category'], f'{path}: category mismatch')
    bones = pose['bones']
    check(all('mixamorig:' + name in bones for name in REQUIRED), f'{path}: missing required bones')
    check(len(bones) == 52, f'{path}: expected 52 bones, got {len(bones)}')
    for name, q in bones.items():
        check(name.startswith('mixamorig:') and isinstance(q, list) and len(q) == 4
              and all(isinstance(v, (int, float)) and math.isfinite(v) for v in q)
              and abs(math.sqrt(sum(v * v for v in q)) - 1) < 1e-5,
              f'{path}: invalid quaternion {name}')
    positions = pose.get('positions', {})
    check(set(positions) == {'mixamorig:Hips'}, f'{path}: root/hips position required')
    hips = positions['mixamorig:Hips']
    check(len(hips) == 3 and all(isinstance(v, (int, float)) and math.isfinite(v)
                                 and abs(v) < 2.5 for v in hips), f'{path}: invalid hips position')
print(f"Validated {len(manifest['poses'])} Mixamo pose files")
