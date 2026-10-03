"""Retarget one CC0 Quaternius UAL GLB clip offline to a Mixamo AnimationClip JSON.

python scripts/convert_animation.py INPUT.glb OUTPUT.json --clip Walk_Loop --name walk-01
Requires numpy and scipy. Source packs stay outside public/.
"""
import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

spec = importlib.util.spec_from_file_location('legacy', Path(__file__).with_name('extract-makehuman-poses.py'))
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


def convert(input_file, output_file, clip_name, output_name, target_file):
    source, data = legacy.read_glb(input_file)
    target, _ = legacy.read_glb(target_file)
    clip = next((entry for entry in source['animations'] if entry['name'] == clip_name), None)
    if clip is None:
        raise ValueError(f'Clip not found: {clip_name}')
    src_names = {node.get('name'): i for i, node in enumerate(source['nodes'])}
    dst_names = {node.get('name'): i for i, node in enumerate(target['nodes'])}
    for src, dst in legacy.SOURCE_TO_TARGET.items():
        if src not in src_names or 'mixamorig:' + dst not in dst_names:
            raise ValueError(f'Missing mapped bone: {src} / {dst}')
    src_rest = legacy.local_rotations(source)
    dst_rest = legacy.local_rotations(target)
    src_world_rest = legacy.world_rotations(source, src_rest)
    dst_world_rest = legacy.world_rotations(target, dst_rest)
    src_positions = legacy.world_positions(source, src_world_rest)
    dst_positions = legacy.world_positions(target, dst_world_rest)
    dst_parent = legacy.parents(target)
    align = {}
    for src, dst in legacy.SOURCE_TO_TARGET.items():
        si = src_names[src]
        children = [i for i in source['nodes'][si].get('children', [])
                    if source['nodes'][i].get('name') in legacy.SOURCE_TO_TARGET]
        if not children:
            align[src] = Rotation.identity()
            continue
        child = children[0]
        target_child = dst_names['mixamorig:' + legacy.SOURCE_TO_TARGET[source['nodes'][child]['name']]]
        align[src], _ = Rotation.align_vectors(
            [src_positions[child] - src_positions[si]],
            [dst_positions[target_child] - dst_positions[dst_names['mixamorig:' + dst]]],
        )
    channels = {}
    time_arrays = []
    for channel in clip['channels']:
        sampler = clip['samplers'][channel['sampler']]
        if sampler.get('interpolation', 'LINEAR') != 'LINEAR':
            raise ValueError('Only sampled LINEAR source tracks are supported')
        times = legacy.accessor(source, data, sampler['input']).ravel()
        values = legacy.accessor(source, data, sampler['output'])
        time_arrays.append(times)
        channels[(channel['target']['node'], channel['target']['path'])] = values
        if channel['target']['path'] == 'scale':
            rest_scale = np.array(source['nodes'][channel['target']['node']].get('scale', [1, 1, 1]))
            if not np.allclose(values, rest_scale, atol=1e-5):
                raise ValueError('Animated scaling must be baked before retargeting')
    times = time_arrays[0]
    if any(len(other) != len(times) or not np.allclose(other, times, atol=1e-5) for other in time_arrays):
        raise ValueError('Source tracks have unsynchronized samples; resample explicitly before converting')
    for src in legacy.SOURCE_TO_TARGET:
        if src == 'pelvis':
            continue
        i = src_names[src]
        bind = np.array(source['nodes'][i].get('translation', [0, 0, 0]))
        moved = channels.get((i, 'translation'))
        if moved is not None and np.linalg.norm(moved - bind, axis=1).max() > .025:
            raise ValueError(f'Unsupported non-pelvis translation: {src}')
    source_height = src_positions[src_names['Head']][1] - src_positions[src_names['pelvis']][1]
    target_height = dst_positions[dst_names['mixamorig:Head']][1] - dst_positions[dst_names['mixamorig:Hips']][1]
    ratio = target_height / source_height
    tracks = {f'mixamorig:{name}.quaternion': [] for name in legacy.SOURCE_TO_TARGET.values()}
    hip_positions = []
    root_index = legacy.parents(source).get(src_names['pelvis'])
    for frame in range(len(times)):
        src_pose = list(src_rest)
        for src in legacy.SOURCE_TO_TARGET:
            index = src_names[src]
            values = channels.get((index, 'rotation'))
            if values is not None:
                src_pose[index] = Rotation.from_quat(values[frame])
        src_world = legacy.world_rotations(source, src_pose)
        dst_pose = list(dst_rest)
        for src, dst in legacy.SOURCE_TO_TARGET.items():
            si = src_names[src]
            di = dst_names['mixamorig:' + dst]
            delta = src_world[si] * src_world_rest[si].inv()
            desired = delta * align[src] * dst_world_rest[di]
            parent = dst_parent.get(di)
            posed_world = legacy.world_rotations(target, dst_pose)
            dst_pose[di] = posed_world[parent].inv() * desired if parent is not None else desired
            q = dst_pose[di].as_quat()
            q /= np.linalg.norm(q)
            tracks[f'mixamorig:{dst}.quaternion'].extend(round(float(value), 8) for value in q)
        pelvis = src_names['pelvis']
        source_local = channels.get((pelvis, 'translation'))
        source_local = source_local[frame] if source_local is not None else np.array(source['nodes'][pelvis].get('translation', [0, 0, 0]))
        bind_local = np.array(source['nodes'][pelvis].get('translation', [0, 0, 0]))
        world_delta = src_world[root_index].apply(source_local - bind_local) if root_index is not None else source_local - bind_local
        target_bind = np.array(target['nodes'][dst_names['mixamorig:Hips']].get('translation', [0, 0, 0]))
        hip = target_bind + world_delta * ratio
        if not np.isfinite(hip).all() or np.max(np.abs(hip)) > 2.5:
            raise ValueError(f'Invalid pelvis position in frame {frame}')
        hip_positions.extend(round(float(value), 8) for value in hip)
    track_json = [{'name': name, 'times': [round(float(t), 6) for t in times],
                   'values': values, 'type': 'quaternion'} for name, values in tracks.items()]
    track_json.append({'name': 'mixamorig:Hips.position',
                       'times': [round(float(t), 6) for t in times],
                       'values': hip_positions, 'type': 'vector'})
    result = {'name': output_name, 'duration': round(float(times[-1]), 6), 'tracks': track_json}
    output_file = Path(output_file)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
    print(f'{output_name}: {len(times)} frames, {result["duration"]} s, {output_file.stat().st_size} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputFile', type=Path)
    parser.add_argument('outputFile', type=Path)
    parser.add_argument('--clip', required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--target', type=Path, default=Path('public/models/human/human.glb'))
    args = parser.parse_args()
    convert(args.inputFile, args.outputFile, args.clip, args.name, args.target)
