"""Retarget three CC0 MakeHuman poses from Cinevva's Quaternius GLB to our Mixamo rig.

Usage: python scripts/extract-makehuman-poses.py path/to/MakeHumanPoses.glb
Requires scipy. The source GLB is only a build input; output is compact pose JSON.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation


def read_glb(path):
    with Path(path).open('rb') as file:
        magic, version, length = struct.unpack('<4sII', file.read(12))
        if magic != b'glTF' or version != 2 or length != Path(path).stat().st_size:
            raise ValueError(f'Invalid GLB: {path}')
        json_length, kind = struct.unpack('<I4s', file.read(8))
        if kind != b'JSON':
            raise ValueError('Expected a JSON chunk')
        document = json.loads(file.read(json_length))
        bin_length, kind = struct.unpack('<I4s', file.read(8))
        if kind != b'BIN\0':
            raise ValueError('Expected a binary chunk')
        return document, file.read(bin_length)


def accessor(document, data, index):
    item = document['accessors'][index]
    view = document['bufferViews'][item['bufferView']]
    if item['componentType'] != 5126 or item['type'] not in ('SCALAR', 'VEC3', 'VEC4'):
        raise ValueError('Expected float scalar, vector or quaternion accessor')
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[item['type']]
    offset = view.get('byteOffset', 0) + item.get('byteOffset', 0)
    stride = view.get('byteStride', width * 4)
    return np.array([np.frombuffer(data, dtype='<f4', count=width, offset=offset + i * stride)
                     for i in range(item['count'])])


def parents(document):
    return {child: index for index, node in enumerate(document['nodes'])
            for child in node.get('children', [])}


def world_rotations(document, local):
    parent = parents(document)
    cache = {}

    def rotation(index):
        if index not in cache:
            value = local[index]
            cache[index] = rotation(parent[index]) * value if index in parent else value
        return cache[index]

    return [rotation(index) for index in range(len(document['nodes']))]


def world_positions(document, rotations):
    parent = parents(document)
    cache = {}

    def position(index):
        if index not in cache:
            translation = np.array(document['nodes'][index].get('translation', [0, 0, 0]))
            cache[index] = (position(parent[index]) + rotations[parent[index]].apply(translation)
                            if index in parent else translation)
        return cache[index]

    return [position(index) for index in range(len(document['nodes']))]


def local_rotations(document):
    return [Rotation.from_quat(node.get('rotation', [0, 0, 0, 1]))
            for node in document['nodes']]


SOURCE_TO_TARGET = {
    'pelvis': 'Hips', 'spine_01': 'Spine', 'spine_02': 'Spine1',
    'spine_03': 'Spine2', 'neck_01': 'Neck', 'Head': 'Head',
}
for side, suffix in [('l', 'Left'), ('r', 'Right')]:
    SOURCE_TO_TARGET.update({
        f'clavicle_{side}': f'{suffix}Shoulder',
        f'upperarm_{side}': f'{suffix}Arm',
        f'lowerarm_{side}': f'{suffix}ForeArm',
        f'hand_{side}': f'{suffix}Hand',
        f'thigh_{side}': f'{suffix}UpLeg',
        f'calf_{side}': f'{suffix}Leg',
        f'foot_{side}': f'{suffix}Foot',
        f'ball_{side}': f'{suffix}ToeBase',
    })
    for finger, target in [('index', 'Index'), ('middle', 'Middle'),
                           ('pinky', 'Pinky'), ('ring', 'Ring'), ('thumb', 'Thumb')]:
        for segment in range(1, 4):
            SOURCE_TO_TARGET[f'{finger}_{segment:02d}_{side}'] = f'{suffix}Hand{target}{segment}'


def main(source_path):
    source, source_data = read_glb(source_path)
    target, _ = read_glb('public/models/human/human.glb')
    source_names = {node.get('name'): index for index, node in enumerate(source['nodes'])}
    target_names = {node.get('name'): index for index, node in enumerate(target['nodes'])}
    source_rest = local_rotations(source)
    target_rest = local_rotations(target)
    source_world_rest = world_rotations(source, source_rest)
    target_world_rest = world_rotations(target, target_rest)
    source_rest_positions = world_positions(source, source_world_rest)
    target_rest_positions = world_positions(target, target_world_rest)
    target_parent = parents(target)
    alignment = {}
    for source_name, target_name in SOURCE_TO_TARGET.items():
        source_index = source_names[source_name]
        target_index = target_names['mixamorig:' + target_name]
        matching_children = [child for child in source['nodes'][source_index].get('children', [])
                             if source['nodes'][child].get('name') in SOURCE_TO_TARGET]
        if not matching_children:
            alignment[source_name] = Rotation.identity()
            continue
        child = matching_children[0]
        child_name = source['nodes'][child]['name']
        target_child = target_names['mixamorig:' + SOURCE_TO_TARGET[child_name]]
        source_direction = source_rest_positions[child] - source_rest_positions[source_index]
        target_direction = target_rest_positions[target_child] - target_rest_positions[target_index]
        alignment[source_name], _ = Rotation.align_vectors([source_direction], [target_direction])
    selected = {
        'Standing 01': ('standing/standing_01.json', 'standing', '01', 'De pie 01'),
        'Fight 01': ('action/fight_01.json', 'action', '04', 'Guardia 01'),
        'Run 01': ('dynamic/run_01.json', 'dynamic', '07', 'Carrera 01'),
    }
    manifest = {'version': 1, 'skeleton': 'mixamorig', 'poses': []}
    for animation in source['animations']:
        if animation.get('name') not in selected:
            continue
        path, category, legacy_id, label = selected[animation['name']]
        source_pose = list(source_rest)
        for channel in animation['channels']:
            if channel['target']['path'] != 'rotation':
                continue
            sampler = animation['samplers'][channel['sampler']]
            values = accessor(source, source_data, sampler['output'])
            source_pose[channel['target']['node']] = Rotation.from_quat(values[0])
        source_world_pose = world_rotations(source, source_pose)
        target_pose = list(target_rest)
        output = {}
        for source_name, target_name in SOURCE_TO_TARGET.items():
            source_index = source_names.get(source_name)
            target_index = target_names.get('mixamorig:' + target_name)
            if source_index is None or target_index is None:
                raise ValueError(f'Missing mapped bone: {source_name} / {target_name}')
            world_delta = source_world_pose[source_index] * source_world_rest[source_index].inv()
            desired_world = world_delta * alignment[source_name] * target_world_rest[target_index]
            parent_index = target_parent.get(target_index)
            posed_world = world_rotations(target, target_pose)
            target_pose[target_index] = posed_world[parent_index].inv() * desired_world if parent_index is not None else desired_world
            quaternion = target_pose[target_index].as_quat()
            output['mixamorig:' + target_name] = [round(float(value), 7) for value in quaternion]
        destination = Path('public/poses') / path
        destination.write_text(json.dumps({'name': destination.stem, 'category': category,
                                           'bones': output}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        manifest['poses'].append({'id': legacy_id, 'name': label, 'category': category,
                                  'type': 'static', 'file': path})
    if len(manifest['poses']) != len(selected):
        raise ValueError('One or more selected poses were absent from the source pack')
    Path('public/poses/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1])
