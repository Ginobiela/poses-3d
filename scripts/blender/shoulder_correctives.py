"""Calibrated shoulder volume recovery, not anatomical sculpting.

Only the chest/clavicle/upper-arm blend changes. Existing elbow/knee keys
remain untouched. Import and export use world deformation, not bone name
coincidence or Blender's converted local axes.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
data = json.loads((root / 'shoulder-calibration.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'shoulder-base.glb'), merge_vertices=False)
body = bpy.data.objects['Body']
armature = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
modifier = next(m for m in body.modifiers if m.type == 'ARMATURE')
C = Matrix.Rotation(math.pi / 2, 4, 'X')
def matrix(values):
    return Matrix([values[i:i+4] for i in range(0, 16, 4)]).transposed()
rest = {n: matrix(v['world']) for n, v in data['rest'].items()}
blender_rest = {b.name: armature.matrix_world @ b.matrix_local for b in armature.data.bones}
alignment = max(((C.inverted() @ body.matrix_world @ v.co) - Vector(data['vertices'][v.index])).length for v in body.data.vertices)
if len(body.data.vertices) != len(data['vertices']) or alignment > 1e-5:
    raise RuntimeError('Vertex alignment changed')
groups = {g.index: g.name for g in body.vertex_groups}
mask = body.vertex_groups.new(name='SHOULDER_corrective_mask')
for vertex in body.data.vertices:
    weights = [(groups[g.group], g.weight) for g in vertex.groups if g.weight > 1e-8]
    names = {n for n, _ in weights}
    for side in ['Left', 'Right']:
        allowed = {f'mixamorig:{side}Shoulder', f'mixamorig:{side}Arm', 'mixamorig:Spine2'}
        if names.issubset(allowed) and f'mixamorig:{side}Arm' in names and len(names) > 1:
            arm_weight = sum(w for n, w in weights if n == f'mixamorig:{side}Arm')
            mask.add([vertex.index], 4 * arm_weight * (1 - arm_weight), 'REPLACE')
smooth = body.modifiers.new('Shoulder deformation fairing', 'CORRECTIVE_SMOOTH')
smooth.vertex_group = mask.name
smooth.factor = .5
smooth.iterations = 5
smooth.smooth_type = 'LENGTH_WEIGHTED'
smooth.rest_source = 'ORCO'
smooth.use_pin_boundary = True
smooth.show_viewport = False
output = dict(blender=bpy.app.version_string, baseSHA256=data['baseSHA256'], alignmentError=alignment,
    method='Preserve Volume plus rest-relative Corrective Smooth', factor=.5, iterations=5,
    mask='4 * armWeight * (1 - armWeight), on chest/clavicle/upper-arm support only', correctives=[])
def evaluate(preserve, fair=False):
    modifier.use_deform_preserve_volume = preserve
    smooth.show_viewport = fair
    bpy.context.view_layer.update()
    obj = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = obj.to_mesh()
    points = [C.inverted() @ obj.matrix_world @ v.co for v in mesh.vertices]
    obj.to_mesh_clear()
    return points

for kind, pose_id in [('Raise', '02'), ('Forward', '20'), ('Back', '07')]:
    sample = next(s for s in data['samples'] if s['id'] == pose_id)
    worlds = {n: matrix(v) for n, v in sample['world'].items()}
    for bone in armature.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    for bone in armature.pose.bones:
        bone.matrix = armature.matrix_world.inverted() @ C @ worlds[bone.name] @ rest[bone.name].inverted() @ C.inverted() @ blender_rest[bone.name]
        bpy.context.view_layer.update()
    lbs, dqs = evaluate(False), evaluate(True, True)
    error = max((p - Vector(ref)).length for p, ref in zip(lbs, sample['posed']))
    if error > 5e-5:
        raise RuntimeError(f'LBS disagreement: {error}')
    for side, suffix in [('Left', 'L'), ('Right', 'R')]:
        name = f'shoulder{kind}_{suffix}'
        allowed = {f'mixamorig:{side}Shoulder', f'mixamorig:{side}Arm', 'mixamorig:Spine2'}
        deltas, determinants = [], []
        for v in body.data.vertices:
            weights = [(groups[g.group], g.weight) for g in v.groups if g.group in groups and g.weight > 1e-8]
            names = {n for n, _ in weights}
            # Actual skinning support defines the region, no distance inflation.
            if not names.issubset(allowed) or f'mixamorig:{side}Arm' not in names or len(names) < 2:
                continue
            skin = Matrix(((0, 0, 0, 0),) * 4)
            for n, w in weights:
                t = worlds[n] @ rest[n].inverted()
                for row in range(4):
                    for col in range(4):
                        skin[row][col] += w * t[row][col]
            determinant = skin.to_3x3().determinant()
            if determinant < 1e-4:
                raise RuntimeError('Singular shoulder skinning')
            determinants.append(determinant)
            delta = skin.inverted().to_3x3() @ (dqs[v.index] - lbs[v.index])
            if not all(math.isfinite(x) for x in delta):
                raise RuntimeError('Non-finite delta')
            if delta.length > 1e-7:
                deltas.append([v.index, *delta])
        key = body.shape_key_add(name=name, from_mix=False)
        key.value = 0
        for index, x, y, z in deltas:
            key.data[index].co += body.matrix_world.inverted().to_3x3() @ C.to_3x3() @ Vector((x, y, z))
        output['correctives'].append(dict(name=name, id=pose_id, region='SHOULDER', poseFile=sample['poseFile'],
            lbsAgreementError=error, vertices=len(deltas), minSkinDeterminant=min(determinants),
            maxDelta=max(Vector(row[1:]).length for row in deltas), deltas=deltas,
            referencePositions=[[row[0], *dqs[row[0]]] for row in deltas]))
        print(name, len(deltas), 'max rest delta', output['correctives'][-1]['maxDelta'])
for bone in armature.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
modifier.use_deform_preserve_volume = False
smooth.show_viewport = False
regions = {'SHOULDER': [], 'TORSO': [], 'PELVIS': [], 'ELBOW': [], 'KNEE': []}
for key in body.data.shape_keys.key_blocks:
    region = 'SHOULDER' if key.name.startswith('shoulder') else 'ELBOW' if key.name.startswith('elbowFlex') else 'KNEE' if key.name.startswith('kneeFlex') else None
    if region:
        regions[region].append(key.name)
body['corrective_regions'] = json.dumps(regions)
text = bpy.data.texts.new('CORRECTIVE_REGIONS.json')
text.write(json.dumps(regions, indent=2))
(root / 'shoulder-correctives.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
master = root / 'anatomy-shoulders.blend'
# Preserve an existing editable master, including any later artistic work.
destination = root / 'anatomy-shoulders-generated.blend' if master.exists() else master
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
