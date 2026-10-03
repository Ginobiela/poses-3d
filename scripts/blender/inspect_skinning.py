"""Blender headless inspection; leaves production assets untouched."""
import bpy
import json
import sys
import math
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
source = Path(args[0]).resolve()
output = Path(args[1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=False)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
report = {'blender': bpy.app.version_string, 'source': source.name, 'meshes': [], 'armatures': []}
for obj in meshes:
    groups = {group.index: group.name for group in obj.vertex_groups}
    stats = {}
    sums = []
    orphaned = 0
    seam_weights = {}
    mismatched_seams = 0
    for vertex in obj.data.vertices:
        if any(not math.isfinite(group.weight) or group.weight < 0 or group.weight > 1 for group in vertex.groups):
            raise RuntimeError('Invalid skin weight.')
        influences = [(groups[group.group], group.weight) for group in vertex.groups if group.weight > 1e-8]
        orphaned += not influences
        position_key = tuple(round(value, 6) for value in vertex.co)
        weight_key = tuple(sorted((name, round(weight, 6)) for name, weight in influences))
        if position_key in seam_weights and seam_weights[position_key] != weight_key:
            mismatched_seams += 1
        seam_weights[position_key] = weight_key
        sums.append(sum(weight for _, weight in influences))
        for name, weight in influences:
            entry = stats.setdefault(name, {'vertices': 0, 'blended': 0, 'min': 1, 'max': 0})
            entry['vertices'] += 1
            entry['blended'] += len(influences) > 1
            entry['min'] = min(entry['min'], weight)
            entry['max'] = max(entry['max'], weight)
    report['meshes'].append({'name': obj.name, 'vertices': len(obj.data.vertices),
        'shapeKeys': len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0,
        'weightSumMin': min(sums), 'weightSumMax': max(sums), 'orphanedVertices': orphaned,
        'coincidentVerticesWithDifferentWeights': mismatched_seams, 'weights': stats})
for obj in armatures:
    report['armatures'].append({'name': obj.name, 'bones': [bone.name for bone in obj.data.bones]})
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2), encoding='utf-8')
print('SKIN_REPORT', output)
