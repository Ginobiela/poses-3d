"""Offline experiment: compare LBS with Blender Preserve Volume, invert LBS.

This restores deformation volume; it does not sculpt contraction or muscles.
Only vertices influenced exclusively by the two joint segments can change.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
data = json.loads((root / 'calibration.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'base.glb'), merge_vertices=False)
body = bpy.data.objects['Body']
armature = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
modifier = next(mod for mod in body.modifiers if mod.type == 'ARMATURE')
coordinate = Matrix.Rotation(math.pi / 2, 4, 'X')
def matrix(values):
    return Matrix([values[i:i+4] for i in range(0, 16, 4)]).transposed()
rest = {name: matrix(item['world']) for name, item in data['rest'].items()}
blender_rest = {bone.name: armature.matrix_world @ bone.matrix_local for bone in armature.data.bones}
source_vertices = [Vector(point) for point in data['vertices']]
if len(body.data.vertices) != len(source_vertices):
    raise RuntimeError('Blender changed vertex count; cannot safely transfer deltas.')
alignment = max(((coordinate.inverted() @ body.matrix_world @ vertex.co) - source_vertices[vertex.index]).length for vertex in body.data.vertices)
if alignment > 1e-5:
    raise RuntimeError(f'Vertex ordering/coordinate mismatch: {alignment}')
group_names = {group.index: group.name for group in body.vertex_groups}
output = {'blender': bpy.app.version_string, 'baseSHA256': data['baseSHA256'], 'alignmentError': alignment, 'correctives': []}

def evaluate(preserve):
    modifier.use_deform_preserve_volume = preserve
    bpy.context.view_layer.update()
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [coordinate.inverted() @ evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    evaluated.to_mesh_clear()
    return points

for spec in data['calibration']:
    worlds = {name: matrix(values) for name, values in spec['world'].items()}
    for bone in armature.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    # Importer may change bone bases. Transfer WORLD deformation, not local quaternions.
    for bone in armature.pose.bones:
        desired = coordinate @ worlds[bone.name] @ rest[bone.name].inverted() @ coordinate.inverted() @ blender_rest[bone.name]
        bone.matrix = armature.matrix_world.inverted() @ desired
        bpy.context.view_layer.update()
    lbs = evaluate(False)
    error = max((point - Vector(reference)).length for point, reference in zip(lbs, spec['posed']))
    if error > 5e-5:
        raise RuntimeError(f"Three.js/Blender LBS differ for {spec['name']}: {error}")
    dqs = evaluate(True)
    pair = {'mixamorig:' + name for name in spec['pair']}
    deltas = []
    determinants = []
    for vertex in body.data.vertices:
        influences = [(group_names[group.group], group.weight) for group in vertex.groups if group.weight > 1e-8]
        names = {name for name, _ in influences}
        if names != pair:
            continue
        skin = Matrix(((0, 0, 0, 0),) * 4)
        for name, weight in influences:
            transform = worlds[name] @ rest[name].inverted()
            for row in range(4):
                for col in range(4):
                    skin[row][col] += weight * transform[row][col]
        determinant = skin.to_3x3().determinant()
        determinants.append(determinant)
        if abs(determinant) < 1e-4:
            raise RuntimeError('Near-singular LBS inverse; corrective cannot be transferred safely.')
        delta = skin.inverted().to_3x3() @ (dqs[vertex.index] - lbs[vertex.index])
        if not all(math.isfinite(value) for value in delta):
            raise RuntimeError('Non-finite corrective delta.')
        if delta.length > 1e-7:
            deltas.append([vertex.index, *delta])
    output['correctives'].append({key: spec[key] for key in ['name', 'id', 'pair', 'end', 'startAngle', 'fullAngle', 'poseFile']} | {
        'lbsAgreementError': error, 'vertices': len(deltas), 'minSkinDeterminant': min(determinants),
        'maxDelta': max(Vector(row[1:]).length for row in deltas), 'deltas': deltas,
        'referencePositions': [[row[0], *dqs[row[0]]] for row in deltas]})
    print('CORRECTIVE', spec['name'], len(deltas), 'LBS agreement', error)
    # Keep a reproducible Blender authoring artifact, including the experimental keys.
    key = body.shape_key_add(name=spec['name'], from_mix=False)
    key.value = 0
    for index, x, y, z in deltas:
        key.data[index].co += body.matrix_world.inverted().to_3x3() @ coordinate.to_3x3() @ Vector((x, y, z))

for bone in armature.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
modifier.use_deform_preserve_volume = False
(root / 'volume-correctives.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(root / 'anatomy-correctives.blend'))
print('Generated experimental volume targets; requires visual acceptance.')
