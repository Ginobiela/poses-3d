"""Convert one licensed Quaternius UAL GLB pose to local Mixamo quaternions.

python scripts/convert_pose.py INPUT.glb OUTPUT.json --clip "Sit 01" --category sitting
Requires numpy and scipy. The input pack is a development asset, never shipped.
"""
import argparse
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation, Slerp


legacy_path = Path(__file__).with_name('extract-makehuman-poses.py')
spec = importlib.util.spec_from_file_location('legacy_retarget', legacy_path)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


def channels_at(document, data, clip, fraction):
    rotations = legacy.local_rotations(document)
    translations = [np.array(node.get('translation', [0, 0, 0]), dtype=float)
                    for node in document['nodes']]
    scales = [np.array(node.get('scale', [1, 1, 1]), dtype=float)
              for node in document['nodes']]
    for channel in clip['channels']:
        sampler = clip['samplers'][channel['sampler']]
        times = legacy.accessor(document, data, sampler['input']).ravel()
        values = legacy.accessor(document, data, sampler['output'])
        moment = float(times[0] + fraction * (times[-1] - times[0]))
        node = channel['target']['node']
        path = channel['target']['path']
        if path == 'rotation':
            if len(times) == 1:
                rotations[node] = Rotation.from_quat(values[0])
            else:
                rotations[node] = Slerp(times, Rotation.from_quat(values))(moment)
        elif path in ('translation', 'scale'):
            if len(times) == 1:
                value = values[0]
            else:
                after = min(int(np.searchsorted(times, moment, side='right')), len(times) - 1)
                before = max(0, after - 1)
                weight = 0 if times[after] == times[before] else (moment - times[before]) / (times[after] - times[before])
                value = values[before] * (1 - weight) + values[after] * weight
            if path == 'translation':
                translations[node] = value
            else:
                scales[node] = value
    return rotations, translations, scales


def world_positions(document, rotations, translations):
    parent = legacy.parents(document)
    cache = {}
    def position(index):
        if index not in cache:
            local = translations[index]
            cache[index] = (position(parent[index]) + rotations[parent[index]].apply(local)
                            if index in parent else local)
        return cache[index]
    return [position(index) for index in range(len(document['nodes']))]


def convert(source_path, output_path, clip_name, category, fraction=0.0,
            target_path=Path('public/models/human/human.glb')):
    source, data = legacy.read_glb(source_path)
    target, _ = legacy.read_glb(target_path)
    source_names = {node.get('name'): i for i, node in enumerate(source['nodes'])}
    target_names = {node.get('name'): i for i, node in enumerate(target['nodes'])}
    missing = [(s, t) for s, t in legacy.SOURCE_TO_TARGET.items()
               if s not in source_names or 'mixamorig:' + t not in target_names]
    if missing:
        raise ValueError(f'Incompatible skeleton mapping: {missing}')
    clip = next((a for a in source['animations'] if a['name'] == clip_name), None)
    if clip is None:
        raise ValueError(f'No clip named {clip_name!r} in source GLB')
    source_rest = legacy.local_rotations(source)
    target_rest = legacy.local_rotations(target)
    source_world_rest = legacy.world_rotations(source, source_rest)
    target_world_rest = legacy.world_rotations(target, target_rest)
    source_rest_positions = legacy.world_positions(source, source_world_rest)
    target_rest_positions = legacy.world_positions(target, target_world_rest)
    source_pose, translations, scales = channels_at(source, data, clip, fraction)
    # Source clips contain per-bone translation tracks. All except the pelvis
    # must remain at bind positions: arbitrary bone offsets require full IK.
    for name in legacy.SOURCE_TO_TARGET:
        if name == 'pelvis':
            continue
        i = source_names[name]
        bind = np.array(source['nodes'][i].get('translation', [0, 0, 0]))
        if np.linalg.norm(translations[i] - bind) > .025:
            raise ValueError(f'{clip_name}: unsupported translation on {name}')
        if np.linalg.norm(scales[i] - 1) > .025:
            raise ValueError(f'{clip_name}: unsupported scale on {name}')
    source_world_pose = legacy.world_rotations(source, source_pose)
    source_pose_positions = world_positions(source, source_world_pose, translations)
    target_parent = legacy.parents(target)
    target_pose = list(target_rest)
    output = {}
    for source_name, target_name in legacy.SOURCE_TO_TARGET.items():
        si = source_names[source_name]
        ti = target_names['mixamorig:' + target_name]
        children = [c for c in source['nodes'][si].get('children', [])
                    if source['nodes'][c].get('name') in legacy.SOURCE_TO_TARGET]
        alignment = Rotation.identity()
        if children:
            child = children[0]
            target_child = target_names['mixamorig:' + legacy.SOURCE_TO_TARGET[source['nodes'][child]['name']]]
            direction_s = source_rest_positions[child] - source_rest_positions[si]
            direction_t = target_rest_positions[target_child] - target_rest_positions[ti]
            alignment, _ = Rotation.align_vectors([direction_s], [direction_t])
        delta = source_world_pose[si] * source_world_rest[si].inv()
        desired = delta * alignment * target_world_rest[ti]
        parent = target_parent.get(ti)
        posed_world = legacy.world_rotations(target, target_pose)
        target_pose[ti] = posed_world[parent].inv() * desired if parent is not None else desired
        q = target_pose[ti].as_quat()
        q /= np.linalg.norm(q)
        output['mixamorig:' + target_name] = [round(float(v), 8) for v in q]
    pelvis_source = source_names['pelvis']
    pelvis_target = target_names['mixamorig:Hips']
    # glTF parent transforms already convert source Z-up to target Y-up.
    source_height = source_rest_positions[source_names['Head']][1] - source_rest_positions[pelvis_source][1]
    target_height = target_rest_positions[target_names['mixamorig:Head']][1] - target_rest_positions[pelvis_target][1]
    ratio = target_height / source_height
    pelvis_delta = (source_pose_positions[pelvis_source] - source_rest_positions[pelvis_source]) * ratio
    pelvis_local = np.array(target['nodes'][pelvis_target].get('translation', [0, 0, 0])) + pelvis_delta
    if not np.isfinite(pelvis_local).all() or np.max(np.abs(pelvis_local)) > 2.5:
        raise ValueError(f'{clip_name}: invalid pelvis translation')
    pose = {'name': Path(output_path).stem, 'category': category, 'bones': output,
            'positions': {'mixamorig:Hips': [round(float(v), 8) for v in pelvis_local]}}
    # Validate the exact serialized values before writing.
    for name, q in output.items():
        if len(q) != 4 or not all(math.isfinite(v) for v in q) or abs(math.sqrt(sum(v * v for v in q)) - 1) > 1e-5:
            raise ValueError(f'{clip_name}: invalid quaternion {name}')
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(pose, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    return pose


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputFile', type=Path)
    parser.add_argument('outputFile', type=Path)
    parser.add_argument('--clip', required=True)
    parser.add_argument('--category', required=True)
    parser.add_argument('--time', type=float, default=0.0, help='Fraction of clip duration, 0..1')
    parser.add_argument('--target', type=Path, default=Path('public/models/human/human.glb'))
    args = parser.parse_args()
    if not 0 <= args.time <= 1:
        parser.error('--time must be between 0 and 1')
    convert(args.inputFile, args.outputFile, args.clip, args.category, args.time, args.target)
