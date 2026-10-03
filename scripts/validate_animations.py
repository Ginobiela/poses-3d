"""Validate all pre-retargeted browser animation tracks and manifest metadata."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public/animations'
manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
assert manifest['skeleton'] == 'mixamorig'
assert len({entry['id'] for entry in manifest['animations']}) == len(manifest['animations'])
required = {'mixamorig:Hips.quaternion', 'mixamorig:Head.quaternion',
            'mixamorig:LeftArm.quaternion', 'mixamorig:RightArm.quaternion',
            'mixamorig:LeftLeg.quaternion', 'mixamorig:RightLeg.quaternion',
            'mixamorig:Hips.position'}
for entry in manifest['animations']:
    assert entry['license'] == 'CC0-1.0' and entry['skeleton'] == 'mixamorig'
    path = (ROOT / entry['file']).resolve()
    assert path.is_relative_to(ROOT.resolve())
    clip = json.loads(path.read_text(encoding='utf-8'))
    assert clip['name'] == entry['id'] and 0 < clip['duration'] < 30
    assert required.issubset({track['name'] for track in clip['tracks']})
    for track in clip['tracks']:
        times, values = track['times'], track['values']
        width = 4 if track['type'] == 'quaternion' else 3
        assert len(times) >= 2 and len(values) == len(times) * width
        assert all(math.isfinite(t) for t in times)
        assert all(a < b for a, b in zip(times, times[1:]))
        assert all(math.isfinite(value) for value in values)
        if width == 4:
            assert all(abs(math.sqrt(sum(v * v for v in values[i:i+4])) - 1) < 1e-5
                       for i in range(0, len(values), 4))
        else:
            assert max(abs(value) for value in values) < 2.5
print(f"Validated {len(manifest['animations'])} Mixamo animation clips")
