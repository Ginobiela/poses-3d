"""Regenerate the selected CC0 pose catalogue from the verified source GLB.

python scripts/build_catalog.py path/to/MakeHumanPoses.glb
Source licensing metadata is pinned in makehuman-source-metadata.json.
"""
import importlib.util
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('convert_pose', Path(__file__).with_name('convert_pose.py'))
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)

# Each entry replaces one historical procedural slot individually. The names
# describe the actual source pose; they are not claims of identical anatomy.
SELECTION = [
    ('01', 'Standing 01', 'De pie 01', 'standing', 'standing/standing_01.json'),
    ('02', 'Spreadcore Arms Up Pose 001', 'Brazos arriba', 'standing', 'standing/arms_up.json'),
    ('03', 'Drednicolson Arms Akimbo', 'Manos a la cintura', 'standing', 'standing/arms_akimbo.json'),
    ('04', 'Fight 01', 'Guardia 01', 'action', 'action/fight_01.json'),
    ('05', 'Elvs Yoga Star Pose 1', 'Equilibrio estrella', 'standing', 'standing/yoga_star.json'),
    ('06', 'Fight 02', 'Guardia 02', 'action', 'action/fight_02.json'),
    ('07', 'Run 01', 'Carrera 01', 'dynamic', 'dynamic/run_01.json'),
    ('08', 'Fly 01', 'Salto en vuelo', 'dynamic', 'dynamic/fly_01.json'),
    ('09', 'Fight 03', 'Guardia 03', 'action', 'action/fight_03.json'),
    ('10', 'Culturalibre Falling', 'Caída', 'dynamic', 'dynamic/falling.json'),
    ('11', 'Sit 01', 'Sentada erguida', 'sitting', 'sitting/sit_01.json'),
    ('12', 'Anrico Sitting 02', 'Sentada 02', 'sitting', 'sitting/sitting_02.json'),
    ('13', 'Anrico Sitting 04', 'Sentada 04', 'sitting', 'sitting/sitting_04.json'),
    ('14', 'Wolgade Sit On Ground 01', 'Sentada en el suelo', 'sitting', 'sitting/ground_01.json'),
    ('15', 'Elvs Yoga Triangle Pose 1', 'Triángulo', 'action', 'action/yoga_triangle.json'),
    ('16', 'Gpedroso Ninja Focus', 'Foco ninja', 'action', 'action/ninja_focus.json'),
    ('17', 'Jjones Leaning On Counter Hands Folded', 'Inclinada', 'action', 'action/leaning.json'),
    ('18', 'Elvs Gymnastic Pose 1', 'Gimnasia 01', 'action', 'action/gymnastic_01.json'),
    ('19', 'Gpedroso Hadouken', 'Extensión diagonal', 'action', 'action/hadouken.json'),
    ('20', 'Drednicolson Prostrate', 'Contracción', 'action', 'action/prostrate.json'),
]


def main(source_file, metadata_file=Path(__file__).with_name('makehuman-source-metadata.json')):
    metadata = json.loads(Path(metadata_file).read_text(encoding='utf-8-sig'))
    if metadata['license'] != 'CC0-1.0' or metadata['skeleton'] != 'Quaternius UAL':
        raise ValueError('Source metadata changed; inspect it before using assets')
    source_poses = {entry['name']: entry for entry in metadata['poses']}
    manifest = {'version': 2, 'skeleton': 'mixamorig', 'poses': []}
    for pose_id, clip, name, category, file in SELECTION:
        entry = source_poses[clip]
        if entry['license'] != 'CC0-1.0':
            raise ValueError(f'{clip} does not have a clear CC0 license')
        converter.convert(source_file, root / 'public/poses' / file, clip, category,
                          target_path=root / 'public/models/human/human.glb')
        manifest['poses'].append({
            'id': pose_id, 'name': name, 'category': category, 'type': 'static',
            'source': 'MakeHuman System Poses' if entry['author'] == 'makehuman_system' else f"MakeHuman / {entry['author']}",
            'sourceClip': clip, 'sourceUrl': entry['sourceUrl'],
            'license': 'CC0-1.0', 'skeletonSource': 'Quaternius UAL',
            'retargetedTo': 'mixamorig', 'file': file,
        })
    (root / 'public/poses/manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
