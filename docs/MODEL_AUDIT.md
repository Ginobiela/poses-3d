# Auditoría del modelo humano

Fase 1. Inspección directa de `public/models/human/human.glb`, con lectura del JSON glTF y carga independiente mediante el mismo `GLTFLoader` de Three.js instalado en el proyecto. No se modificó el asset ni la aplicación.

## Identidad y método

- Archivo: `public/models/human/human.glb`.
- Tamaño: 6,806,984 bytes.
- SHA-256: `6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18`.
- glTF: 2.0; generador: `three.ws build-parametric-base`.
- Procedencia y licencia: `public/models/human/SOURCE.txt` y `LICENSE.txt`; datos MakeHuman/MPFB2 CC0 incorporados desde la revisión fijada de three.ws. El hash coincide con el registro de origen.
- Reproducir: `node scripts/audit-model.mjs --report docs/MODEL_AUDIT.md`. Sin `--report` produce JSON en stdout. La herramienta comprueba la correspondencia de nombres/índices, los deltas reales de morphs y los datos de skinning.
- Los vértices contados son entradas POSITION por primitiva, incluidos posibles vértices duplicados por costuras; no son puntos topológicos únicos soldados.

## Resumen

- 4 meshes; los 4 se cargan como SkinnedMesh.
- 15,066 vértices y 27,676 triángulos.
- 1 skin: `ParametricSkin`, con 52 huesos `mixamorig:*`.
- 306 nombres únicos de morph; 395 slots sumando los cuatro meshes.
- 4 materiales PBR; 0 texturas, 0 imágenes y ningún normal map.
- 0 AnimationClips embebidos. Las animaciones del sitio siguen siendo recursos separados.

## Meshes y skinning

| Mesh | Nodo / skin | Tipo Three.js | Vértices | Triángulos | Morphs | Material |
|---|---|---|---:|---:|---:|---|
| Body | 53 / 0 | SkinnedMesh | 14517 | 26756 | 306 | Parametric_Body |
| Eyes | 54 / 0 | SkinnedMesh | 160 | 280 | 30 | Parametric_Eyes |
| Teeth | 55 / 0 | SkinnedMesh | 136 | 192 | 32 | Parametric_Teeth |
| Tongue | 56 / 0 | SkinnedMesh | 253 | 448 | 27 | Parametric_Tongue |

Cada mesh tiene una primitiva TRIANGLES con POSITION, NORMAL, TEXCOORD_0, JOINTS_0 y WEIGHTS_0, y comparte el skin de 52 huesos. Hay cuatro componentes de skinning por vértice; los índices apuntan a joints válidos y los pesos son finitos y no negativos.

| Mesh | Suma mínima de pesos | Suma máxima de pesos |
|---|---:|---:|
| Body | 0.99999996 | 1.00000004 |
| Eyes | 1.00000000 | 1.00000000 |
| Teeth | 1.00000000 | 1.00000000 |
| Tongue | 1.00000000 | 1.00000000 |

Esta comprobación valida la estructura del skinning; no certifica la calidad anatómica de sus deformaciones, reservada para la Fase 6.

## Esqueleto completo

Skin: `ParametricSkin`; raíz declarada: `mixamorig:Hips`; 52 inverse bind matrices. La raíz externa de escena es ParametricBase.

Los nombres siguientes son los exactos del GLB. GLTFLoader sanitiza `:` a `_` en Object3D.name; el adaptador actual recupera los nombres originales desde userData.name. La tabla muestra el orden del array joints, que no es un recorrido jerárquico.

| Joint | Nodo | Nombre exacto | Padre |
|---:|---:|---|---|
| 0 | 1 | `mixamorig:Head` | `mixamorig:Neck` |
| 1 | 2 | `mixamorig:Hips` | `ParametricBase` |
| 2 | 3 | `mixamorig:LeftArm` | `mixamorig:LeftShoulder` |
| 3 | 4 | `mixamorig:LeftFoot` | `mixamorig:LeftLeg` |
| 4 | 5 | `mixamorig:LeftForeArm` | `mixamorig:LeftArm` |
| 5 | 6 | `mixamorig:LeftHand` | `mixamorig:LeftForeArm` |
| 6 | 7 | `mixamorig:LeftHandIndex1` | `mixamorig:LeftHand` |
| 7 | 8 | `mixamorig:LeftHandIndex2` | `mixamorig:LeftHandIndex1` |
| 8 | 9 | `mixamorig:LeftHandIndex3` | `mixamorig:LeftHandIndex2` |
| 9 | 10 | `mixamorig:LeftHandMiddle1` | `mixamorig:LeftHand` |
| 10 | 11 | `mixamorig:LeftHandMiddle2` | `mixamorig:LeftHandMiddle1` |
| 11 | 12 | `mixamorig:LeftHandMiddle3` | `mixamorig:LeftHandMiddle2` |
| 12 | 13 | `mixamorig:LeftHandPinky1` | `mixamorig:LeftHand` |
| 13 | 14 | `mixamorig:LeftHandPinky2` | `mixamorig:LeftHandPinky1` |
| 14 | 15 | `mixamorig:LeftHandPinky3` | `mixamorig:LeftHandPinky2` |
| 15 | 16 | `mixamorig:LeftHandRing1` | `mixamorig:LeftHand` |
| 16 | 17 | `mixamorig:LeftHandRing2` | `mixamorig:LeftHandRing1` |
| 17 | 18 | `mixamorig:LeftHandRing3` | `mixamorig:LeftHandRing2` |
| 18 | 19 | `mixamorig:LeftHandThumb1` | `mixamorig:LeftHand` |
| 19 | 20 | `mixamorig:LeftHandThumb2` | `mixamorig:LeftHandThumb1` |
| 20 | 21 | `mixamorig:LeftHandThumb3` | `mixamorig:LeftHandThumb2` |
| 21 | 22 | `mixamorig:LeftLeg` | `mixamorig:LeftUpLeg` |
| 22 | 23 | `mixamorig:LeftShoulder` | `mixamorig:Spine2` |
| 23 | 24 | `mixamorig:LeftToeBase` | `mixamorig:LeftFoot` |
| 24 | 25 | `mixamorig:LeftUpLeg` | `mixamorig:Hips` |
| 25 | 26 | `mixamorig:Neck` | `mixamorig:Spine2` |
| 26 | 27 | `mixamorig:RightArm` | `mixamorig:RightShoulder` |
| 27 | 28 | `mixamorig:RightFoot` | `mixamorig:RightLeg` |
| 28 | 29 | `mixamorig:RightForeArm` | `mixamorig:RightArm` |
| 29 | 30 | `mixamorig:RightHand` | `mixamorig:RightForeArm` |
| 30 | 31 | `mixamorig:RightHandIndex1` | `mixamorig:RightHand` |
| 31 | 32 | `mixamorig:RightHandIndex2` | `mixamorig:RightHandIndex1` |
| 32 | 33 | `mixamorig:RightHandIndex3` | `mixamorig:RightHandIndex2` |
| 33 | 34 | `mixamorig:RightHandMiddle1` | `mixamorig:RightHand` |
| 34 | 35 | `mixamorig:RightHandMiddle2` | `mixamorig:RightHandMiddle1` |
| 35 | 36 | `mixamorig:RightHandMiddle3` | `mixamorig:RightHandMiddle2` |
| 36 | 37 | `mixamorig:RightHandPinky1` | `mixamorig:RightHand` |
| 37 | 38 | `mixamorig:RightHandPinky2` | `mixamorig:RightHandPinky1` |
| 38 | 39 | `mixamorig:RightHandPinky3` | `mixamorig:RightHandPinky2` |
| 39 | 40 | `mixamorig:RightHandRing1` | `mixamorig:RightHand` |
| 40 | 41 | `mixamorig:RightHandRing2` | `mixamorig:RightHandRing1` |
| 41 | 42 | `mixamorig:RightHandRing3` | `mixamorig:RightHandRing2` |
| 42 | 43 | `mixamorig:RightHandThumb1` | `mixamorig:RightHand` |
| 43 | 44 | `mixamorig:RightHandThumb2` | `mixamorig:RightHandThumb1` |
| 44 | 45 | `mixamorig:RightHandThumb3` | `mixamorig:RightHandThumb2` |
| 45 | 46 | `mixamorig:RightLeg` | `mixamorig:RightUpLeg` |
| 46 | 47 | `mixamorig:RightShoulder` | `mixamorig:Spine2` |
| 47 | 48 | `mixamorig:RightToeBase` | `mixamorig:RightFoot` |
| 48 | 49 | `mixamorig:RightUpLeg` | `mixamorig:Hips` |
| 49 | 50 | `mixamorig:Spine` | `mixamorig:Hips` |
| 50 | 51 | `mixamorig:Spine1` | `mixamorig:Spine` |
| 51 | 52 | `mixamorig:Spine2` | `mixamorig:Spine1` |

## Materiales

| Nombre | BaseColor RGBA | Roughness | Metallic | Normal map | Alpha / caras |
|---|---|---:|---:|---|---|
| Parametric_Body | 0.72, 0.42, 0.29, 1 | 0.85 | 0 | No | OPAQUE / frontal |
| Parametric_Eyes | 0.18, 0.12, 0.09, 1 | 0.25 | 0 | No | OPAQUE / frontal |
| Parametric_Teeth | 0.93, 0.91, 0.86, 1 | 0.4 | 0 | No | OPAQUE / frontal |
| Parametric_Tongue | 0.66, 0.3, 0.28, 1 | 0.6 | 0 | No | OPAQUE / frontal |

Los NORMAL base son atributos de vértice, no normal maps. No hay imágenes, texturas PBR ni extensiones de materiales en este GLB.

## Morph targets y límites declarados

Los nombres proceden de meshes[].extras.targetNames y se comprobaron contra morphTargetDictionary tras la carga. Los índices son locales a cada mesh. Los cuatro meshes usan morphTargetsRelative = true. Todos los pesos iniciales son 0.

Cada target contiene exclusivamente POSITION: deltas relativos de vértices. No hay targets NORMAL ni TANGENT. Los datos sparse se decodificaron con GLTFLoader antes de medirlos; no se contó solo la metadata. La tabla incluye los vértices con delta no nulo y el máximo módulo de desplazamiento por mesh en unidades locales del GLB.

Hay 388 slots con desplazamiento no nulo y 7 slots completamente nulos: Eyes/eyeBagsLeft, Eyes/jawBonesSofter, Eyes/headAged, Eyes/headYouthful, Teeth/jawBonesSofter, Tongue/jawBonesSofter y Tongue/headAged. Sus nombres existen en esos meshes, pero activar esa ocurrencia no mueve vértices. Los 306 targets de Body sí tienen deltas no nulos.

El archivo no declara rangos mínimos/máximos de influencia, exclusiones de pares opuestos ni límites de combinación. Los min/max de accessors acotan los deltas de posición, no las influencias. No debe presentarse 0–1 como un límite anatómico validado por este asset. Una política conservadora de UI y los presets deberán evaluarse en las fases siguientes.

Los nombres compartidos pueden afectar ojos, dientes y lengua además del cuerpo. Un controlador futuro deberá encontrar todas sus ocurrencias para evitar desalineaciones. El skeleton no contiene morph targets ni está deformado por estos deltas de mesh; los cambios grandes de altura o longitud requieren comprobar compatibilidad con las articulaciones.

Sin deltas de normales, las influencias cambian la superficie pero no corrigen explícitamente las normales exportadas. Esto puede limitar la lectura de volumen con modificaciones fuertes. La auditoría no recompone normales ni modifica geometría.

## Morphs relacionados con anatomía corporal

| Grupo solicitado | Nombres exactos encontrados en Body |
|---|---|
| Muscle / musculatura | `bodyMuscular`, `chestPectorals`, `bellyToned`, `armsMuscular`, `thighsMuscular`, `calvesMuscular`, `chestPectoralsLess`, `armsLessMuscular`, `armsShouldersLessMuscular`, `thighsLessMuscular`, `calvesLessMuscular` |
| Weight / peso y suavidad | `bodySofter`, `bodyHeavier`, `bodyThinner`, `bellyBigger`, `bellySmaller`, `bellySoft` |
| Height / altura | `heightTaller`, `heightShorter` |
| Gender / sex | `bodyFeminine`, `bodyMasculine` |
| Torso | `chestWider`, `chestNarrower`, `chestDeeper`, `chestVShape`, `chestPectorals`, `waistWider`, `waistNarrower`, `bellyBigger`, `bellyToned`, `chestShallower`, `chestTaller`, `chestShorter`, `chestVShapeLess`, `chestPectoralsLess`, `torsoLatsWider`, `torsoLatsNarrower`, `torsoFrontChestWider`, `torsoFrontChestNarrower`, `torsoUnderbustWider`, `torsoUnderbustNarrower`, `bellySmaller`, `bellySoft`, `bellyNavelUp`, `bellyNavelDown` |
| Chest / pecho | `chestWider`, `chestNarrower`, `chestDeeper`, `chestVShape`, `chestPectorals`, `bustBigger`, `bustSmaller`, `chestShallower`, `chestTaller`, `chestShorter`, `chestVShapeLess`, `chestPectoralsLess`, `torsoFrontChestWider`, `torsoFrontChestNarrower`, `torsoUnderbustWider`, `torsoUnderbustNarrower` |
| Shoulders / hombros | `shouldersWider`, `shouldersNarrower`, `armsShouldersLessMuscular` |
| Arms / brazos | `armsMuscular`, `armsThicker`, `armsThinner`, `armsLonger`, `armsShorter`, `armsUpperWider`, `armsUpperNarrower`, `armsLowerWider`, `armsLowerNarrower`, `armsUpperDeeper`, `armsLowerDeeper`, `armsUpperTaller`, `armsLowerTaller`, `armsLessMuscular`, `armsShouldersLessMuscular` |
| Legs / piernas | `thighsThicker`, `thighsThinner`, `thighsMuscular`, `calvesMuscular`, `legsLonger`, `legsShorter`, `legsThighsWider`, `legsThighsNarrower`, `legsCalvesWider`, `legsCalvesNarrower`, `legsThighsDeeper`, `legsCalvesDeeper`, `legsKneesIn`, `legsKneesOut`, `calvesThicker`, `calvesThinner`, `thighsLessMuscular`, `calvesLessMuscular`, `legsUpperLonger`, `legsUpperShorter`, `legsLowerLonger`, `legsLowerShorter` |
| Hips / caderas | `hipsWider`, `hipsNarrower`, `gluteusBigger`, `gluteusSmaller`, `hipsCircWider`, `hipsCircNarrower`, `hipsDeeper`, `hipsTaller`, `hipsShorter`, `hipsWaistUp`, `hipsWaistDown` |
| Proportions / proporciones | `headWider`, `headNarrower`, `headTaller`, `headShorter`, `headDeeper`, `headShallower`, `neckLonger`, `neckShorter`, `heightTaller`, `heightShorter`, `chestWider`, `chestNarrower`, `chestDeeper`, `waistWider`, `waistNarrower`, `shouldersWider`, `shouldersNarrower`, `hipsWider`, `hipsNarrower`, `armsLonger`, `armsShorter`, `legsLonger`, `legsShorter`, `headBackDeeper`, `neckBackDeeper`, `chestShallower`, `chestTaller`, `chestShorter`, `hipsCircWider`, `hipsCircNarrower`, `hipsDeeper`, `hipsTaller`, `hipsShorter`, `hipsWaistUp`, `hipsWaistDown`, `armsUpperWider`, `armsUpperNarrower`, `armsLowerWider`, `armsLowerNarrower`, `armsUpperDeeper`, `armsLowerDeeper`, `armsUpperTaller`, `armsLowerTaller`, `legsThighsWider`, `legsThighsNarrower`, `legsCalvesWider`, `legsCalvesNarrower`, `legsThighsDeeper`, `legsCalvesDeeper`, `legsUpperLonger`, `legsUpperShorter`, `legsLowerLonger`, `legsLowerShorter` |

La clasificación anterior identifica candidatos por sus nombres reales. bodyFeminine/bodyMasculine son etiquetas del asset, no una garantía de representar todas las características sexuales o corporales. La eficacia visual y la seguridad de combinaciones no se certifican por el nombre.

No aparecen nombres explícitos de correctivos articulares como elbowFlex_L, kneeFlex_L, shoulderRaise_L o torsoTwist_L. Los morphs de musculatura existentes son de forma corporal; esta fase no infiere activadores de pose ni conecta correctivos. Su evaluación y especificación corresponden a las fases posteriores.

## Inventario completo de morph targets

| Nombre exacto | Mesh: índice local | Vértices afectados por mesh | Delta máximo por mesh |
|---|---|---|---|
| `noseWider` | Body: 0 | Body: 448 | Body: 0.003400 |
| `noseNarrower` | Body: 1 | Body: 312 | Body: 0.004600 |
| `noseLonger` | Body: 2 | Body: 397 | Body: 0.005500 |
| `noseShorter` | Body: 3 | Body: 335 | Body: 0.007700 |
| `noseBigger` | Body: 4 | Body: 121 | Body: 0.005148 |
| `noseSmaller` | Body: 5 | Body: 48 | Body: 0.007701 |
| `noseTipUp` | Body: 6 | Body: 77 | Body: 0.004601 |
| `noseTipDown` | Body: 7 | Body: 100 | Body: 0.015394 |
| `noseHump` | Body: 8 | Body: 406 | Body: 0.004472 |
| `noseConcave` | Body: 9 | Body: 70 | Body: 0.005263 |
| `noseNostrilsWider` | Body: 10 | Body: 252 | Body: 0.005000 |
| `noseNostrilsNarrower` | Body: 11 | Body: 198 | Body: 0.002433 |
| `mouthWider` | Body: 12; Teeth: 0 | Body: 870; Teeth: 128 | Body: 0.005009; Teeth: 0.006200 |
| `mouthNarrower` | Body: 13; Teeth: 1 | Body: 746; Teeth: 128 | Body: 0.005500; Teeth: 0.006200 |
| `mouthUpperLipFuller` | Body: 14 | Body: 145 | Body: 0.002968 |
| `mouthUpperLipThinner` | Body: 15 | Body: 95 | Body: 0.002311 |
| `mouthLowerLipFuller` | Body: 16 | Body: 135 | Body: 0.004790 |
| `mouthLowerLipThinner` | Body: 17 | Body: 64 | Body: 0.002317 |
| `mouthCornersUp` | Body: 18 | Body: 438 | Body: 0.005300 |
| `mouthCornersDown` | Body: 19 | Body: 490 | Body: 0.004300 |
| `mouthCupidsBow` | Body: 20 | Body: 85 | Body: 0.003043 |
| `mouthDimples` | Body: 21 | Body: 24 | Body: 0.002256 |
| `mouthForward` | Body: 22; Teeth: 2; Tongue: 0 | Body: 783; Teeth: 136; Tongue: 253 | Body: 0.010300; Teeth: 0.010300; Tongue: 0.010300 |
| `mouthBackward` | Body: 23; Teeth: 3; Tongue: 1 | Body: 829; Teeth: 136; Tongue: 253 | Body: 0.006400; Teeth: 0.006400; Tongue: 0.006400 |
| `earScaleLeft` | Body: 24 | Body: 514 | Body: 0.010847 |
| `earScaleRight` | Body: 25 | Body: 514 | Body: 0.010847 |
| `earSmallerLeft` | Body: 26 | Body: 511 | Body: 0.010519 |
| `earSmallerRight` | Body: 27 | Body: 511 | Body: 0.010519 |
| `earPointedLeft` | Body: 28 | Body: 127 | Body: 0.023629 |
| `earPointedRight` | Body: 29 | Body: 127 | Body: 0.023629 |
| `earLobeBiggerLeft` | Body: 30 | Body: 26 | Body: 0.009590 |
| `earLobeBiggerRight` | Body: 31 | Body: 26 | Body: 0.009590 |
| `earWingOutLeft` | Body: 32 | Body: 331 | Body: 0.013202 |
| `earWingOutRight` | Body: 33 | Body: 331 | Body: 0.013202 |
| `earHigherLeft` | Body: 34 | Body: 489 | Body: 0.020000 |
| `earHigherRight` | Body: 35 | Body: 489 | Body: 0.020000 |
| `earLowerLeft` | Body: 36 | Body: 489 | Body: 0.020000 |
| `earLowerRight` | Body: 37 | Body: 489 | Body: 0.020000 |
| `eyeBiggerLeft` | Body: 38 | Body: 497 | Body: 0.002406 |
| `eyeBiggerRight` | Body: 39 | Body: 489 | Body: 0.002404 |
| `eyeSmallerLeft` | Body: 40 | Body: 490 | Body: 0.003780 |
| `eyeSmallerRight` | Body: 41 | Body: 490 | Body: 0.003780 |
| `eyeOuterUpLeft` | Body: 42 | Body: 169 | Body: 0.002500 |
| `eyeOuterUpRight` | Body: 43 | Body: 156 | Body: 0.002500 |
| `eyeOuterDownLeft` | Body: 44 | Body: 169 | Body: 0.002500 |
| `eyeOuterDownRight` | Body: 45 | Body: 156 | Body: 0.002500 |
| `eyeInwardLeft` | Body: 46; Eyes: 0 | Body: 493; Eyes: 80 | Body: 0.003400; Eyes: 0.003400 |
| `eyeInwardRight` | Body: 47; Eyes: 1 | Body: 486; Eyes: 80 | Body: 0.003400; Eyes: 0.003400 |
| `eyeOutwardLeft` | Body: 48; Eyes: 2 | Body: 621; Eyes: 80 | Body: 0.004600; Eyes: 0.004600 |
| `eyeOutwardRight` | Body: 49; Eyes: 3 | Body: 621; Eyes: 80 | Body: 0.004600; Eyes: 0.004600 |
| `eyeBagsLeft` | Body: 50; Eyes: 4 | Body: 40; Eyes: 0 | Body: 0.004041; Eyes: 0.000000 |
| `eyeBagsRight` | Body: 51 | Body: 39 | Body: 0.004041 |
| `browsUp` | Body: 52 | Body: 449 | Body: 0.007134 |
| `browsDown` | Body: 53 | Body: 380 | Body: 0.008400 |
| `browsAngleUp` | Body: 54 | Body: 270 | Body: 0.008081 |
| `browsAngleDown` | Body: 55 | Body: 446 | Body: 0.009200 |
| `cheekBonesLeft` | Body: 56 | Body: 59 | Body: 0.008100 |
| `cheekBonesRight` | Body: 57 | Body: 59 | Body: 0.008100 |
| `cheekFullerLeft` | Body: 58 | Body: 212 | Body: 0.009459 |
| `cheekFullerRight` | Body: 59 | Body: 212 | Body: 0.009459 |
| `cheekHollowLeft` | Body: 60 | Body: 155 | Body: 0.006918 |
| `cheekHollowRight` | Body: 61 | Body: 155 | Body: 0.006918 |
| `jawWider` | Body: 62 | Body: 198 | Body: 0.011904 |
| `jawNarrower` | Body: 63 | Body: 142 | Body: 0.005109 |
| `jawChinLonger` | Body: 64; Tongue: 2 | Body: 533; Tongue: 63 | Body: 0.020500; Tongue: 0.020400 |
| `jawChinShorter` | Body: 65 | Body: 278 | Body: 0.009900 |
| `jawChinPointed` | Body: 66 | Body: 378 | Body: 0.008600 |
| `jawChinCleft` | Body: 67 | Body: 39 | Body: 0.003499 |
| `jawChinForward` | Body: 68; Teeth: 4 | Body: 351; Teeth: 20 | Body: 0.007000; Teeth: 0.007000 |
| `jawChinBack` | Body: 69; Teeth: 5 | Body: 483; Teeth: 20 | Body: 0.007900; Teeth: 0.007000 |
| `headWider` | Body: 70; Eyes: 5; Teeth: 6; Tongue: 3 | Body: 4314; Eyes: 160; Teeth: 128; Tongue: 226 | Body: 0.017000; Eyes: 0.009644; Teeth: 0.005900; Tongue: 0.005400 |
| `headNarrower` | Body: 71; Eyes: 6; Teeth: 7; Tongue: 4 | Body: 4314; Eyes: 160; Teeth: 128; Tongue: 226 | Body: 0.017000; Eyes: 0.009644; Teeth: 0.005900; Tongue: 0.005400 |
| `headTaller` | Body: 72; Eyes: 7; Teeth: 8; Tongue: 5 | Body: 4401; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.023100; Eyes: 0.001500; Teeth: 0.011000; Tongue: 0.011000 |
| `headShorter` | Body: 73; Eyes: 8; Teeth: 9; Tongue: 6 | Body: 4401; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.023100; Eyes: 0.001500; Teeth: 0.011000; Tongue: 0.011000 |
| `headDeeper` | Body: 74; Eyes: 9; Teeth: 10; Tongue: 7 | Body: 3715; Eyes: 160; Teeth: 136; Tongue: 242 | Body: 0.011300; Eyes: 0.011300; Teeth: 0.011300; Tongue: 0.011300 |
| `headShallower` | Body: 75; Eyes: 10; Teeth: 11; Tongue: 8 | Body: 3715; Eyes: 160; Teeth: 136; Tongue: 242 | Body: 0.007700; Eyes: 0.007600; Teeth: 0.007700; Tongue: 0.007600 |
| `headRound` | Body: 76 | Body: 1843 | Body: 0.012050 |
| `headSquare` | Body: 77 | Body: 529 | Body: 0.011034 |
| `headOval` | Body: 78 | Body: 1942 | Body: 0.012970 |
| `foreheadRounder` | Body: 79 | Body: 290 | Body: 0.058950 |
| `foreheadFlatter` | Body: 80 | Body: 280 | Body: 0.044628 |
| `neckThicker` | Body: 81 | Body: 742 | Body: 0.013603 |
| `neckThinner` | Body: 82 | Body: 740 | Body: 0.013025 |
| `neckLonger` | Body: 83; Eyes: 11; Teeth: 12; Tongue: 9 | Body: 4531; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.053800; Eyes: 0.053800; Teeth: 0.053800; Tongue: 0.053800 |
| `neckShorter` | Body: 84; Eyes: 12; Teeth: 13; Tongue: 10 | Body: 4745; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.038000; Eyes: 0.027700; Teeth: 0.027700; Tongue: 0.027700 |
| `bodyFeminine` | Body: 85; Eyes: 13; Teeth: 14; Tongue: 11 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.102858; Eyes: 0.062735; Teeth: 0.062961; Tongue: 0.059399 |
| `bodyMasculine` | Body: 86; Eyes: 14; Teeth: 15; Tongue: 12 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.112728; Eyes: 0.076473; Teeth: 0.073438; Tongue: 0.086519 |
| `bodyMuscular` | Body: 87 | Body: 4359 | Body: 0.023010 |
| `bodySofter` | Body: 88 | Body: 3808 | Body: 0.027350 |
| `bodyHeavier` | Body: 89 | Body: 4195 | Body: 0.021620 |
| `bodyThinner` | Body: 90; Tongue: 13 | Body: 4480; Tongue: 15 | Body: 0.020123; Tongue: 0.000439 |
| `bodyOlder` | Body: 91; Eyes: 15; Teeth: 16; Tongue: 14 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.040859; Eyes: 0.029369; Teeth: 0.028507; Tongue: 0.028842 |
| `heightTaller` | Body: 92; Eyes: 16; Teeth: 17; Tongue: 15 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.720451; Eyes: 0.692843; Teeth: 0.675521; Tongue: 0.672238 |
| `heightShorter` | Body: 93; Eyes: 17; Teeth: 18; Tongue: 16 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.366940; Eyes: 0.355602; Teeth: 0.348726; Tongue: 0.347924 |
| `chestWider` | Body: 94 | Body: 6038 | Body: 0.034200 |
| `chestNarrower` | Body: 95 | Body: 6390 | Body: 0.033800 |
| `chestDeeper` | Body: 96 | Body: 1651 | Body: 0.033600 |
| `chestVShape` | Body: 97 | Body: 5524 | Body: 0.026700 |
| `chestPectorals` | Body: 98 | Body: 472 | Body: 0.035859 |
| `waistWider` | Body: 99 | Body: 834 | Body: 0.028111 |
| `waistNarrower` | Body: 100 | Body: 834 | Body: 0.028111 |
| `bustBigger` | Body: 101 | Body: 1215 | Body: 0.044047 |
| `bustSmaller` | Body: 102 | Body: 1218 | Body: 0.032369 |
| `shouldersWider` | Body: 103 | Body: 5030 | Body: 0.024900 |
| `shouldersNarrower` | Body: 104 | Body: 5208 | Body: 0.013500 |
| `bellyBigger` | Body: 105 | Body: 346 | Body: 0.098034 |
| `bellyToned` | Body: 106 | Body: 173 | Body: 0.008505 |
| `hipsWider` | Body: 107 | Body: 1110 | Body: 0.037300 |
| `hipsNarrower` | Body: 108 | Body: 1110 | Body: 0.037300 |
| `gluteusBigger` | Body: 109 | Body: 510 | Body: 0.021504 |
| `gluteusSmaller` | Body: 110 | Body: 204 | Body: 0.019875 |
| `armsMuscular` | Body: 111 | Body: 888 | Body: 0.021926 |
| `armsThicker` | Body: 112 | Body: 1462 | Body: 0.017743 |
| `armsThinner` | Body: 113 | Body: 1090 | Body: 0.011841 |
| `armsLonger` | Body: 114 | Body: 4650 | Body: 0.120393 |
| `armsShorter` | Body: 115 | Body: 4644 | Body: 0.084764 |
| `thighsThicker` | Body: 116 | Body: 997 | Body: 0.033055 |
| `thighsThinner` | Body: 117 | Body: 592 | Body: 0.023218 |
| `thighsMuscular` | Body: 118 | Body: 546 | Body: 0.015814 |
| `calvesMuscular` | Body: 119 | Body: 351 | Body: 0.036834 |
| `legsLonger` | Body: 120 | Body: 3538 | Body: 0.187267 |
| `legsShorter` | Body: 121 | Body: 3698 | Body: 0.134006 |
| `noseBridgeWider` | Body: 122 | Body: 56 | Body: 0.002302 |
| `noseBridgeNarrower` | Body: 123 | Body: 52 | Body: 0.001825 |
| `noseMidWider` | Body: 124 | Body: 78 | Body: 0.002907 |
| `noseMidNarrower` | Body: 125 | Body: 40 | Body: 0.002309 |
| `noseBaseWider` | Body: 126 | Body: 378 | Body: 0.004900 |
| `noseBaseNarrower` | Body: 127 | Body: 234 | Body: 0.003102 |
| `noseDeeper` | Body: 128 | Body: 366 | Body: 0.008600 |
| `noseShallower` | Body: 129 | Body: 342 | Body: 0.011800 |
| `noseTipWider` | Body: 130 | Body: 42 | Body: 0.001530 |
| `noseTipNarrower` | Body: 131 | Body: 64 | Body: 0.002408 |
| `noseFlaring` | Body: 132 | Body: 130 | Body: 0.004608 |
| `noseFlaringLess` | Body: 133 | Body: 134 | Body: 0.003225 |
| `noseNostrilsAngleUp` | Body: 134 | Body: 196 | Body: 0.004342 |
| `noseNostrilsAngleDown` | Body: 135 | Body: 164 | Body: 0.005000 |
| `noseBaseUp` | Body: 136 | Body: 294 | Body: 0.004100 |
| `noseBaseDown` | Body: 137 | Body: 309 | Body: 0.004900 |
| `noseGreek` | Body: 138 | Body: 45 | Body: 0.003401 |
| `noseConvex` | Body: 139 | Body: 52 | Body: 0.006648 |
| `noseHumpLess` | Body: 140 | Body: 28 | Body: 0.003329 |
| `noseCompressed` | Body: 141 | Body: 81 | Body: 0.005749 |
| `noseForward` | Body: 142 | Body: 445 | Body: 0.005900 |
| `noseBackward` | Body: 143; Teeth: 19 | Body: 582; Teeth: 11 | Body: 0.003400; Teeth: 0.005632 |
| `noseHigher` | Body: 144 | Body: 526 | Body: 0.004100 |
| `noseLower` | Body: 145 | Body: 406 | Body: 0.003700 |
| `mouthTaller` | Body: 146; Teeth: 20 | Body: 798; Teeth: 134 | Body: 0.004100; Teeth: 0.006900 |
| `mouthShorter` | Body: 147 | Body: 467 | Body: 0.003500 |
| `mouthDeeper` | Body: 148 | Body: 476 | Body: 0.003000 |
| `mouthShallower` | Body: 149 | Body: 485 | Body: 0.004000 |
| `mouthUpperLipWider` | Body: 150 | Body: 676 | Body: 0.005500 |
| `mouthUpperLipNarrower` | Body: 151 | Body: 176 | Body: 0.003100 |
| `mouthLowerLipWider` | Body: 152 | Body: 162 | Body: 0.004100 |
| `mouthLowerLipNarrower` | Body: 153 | Body: 116 | Body: 0.005900 |
| `mouthUpperLipTaller` | Body: 154 | Body: 212 | Body: 0.002400 |
| `mouthUpperLipShorter` | Body: 155 | Body: 206 | Body: 0.003500 |
| `mouthLowerLipTaller` | Body: 156 | Body: 64 | Body: 0.006100 |
| `mouthLowerLipShorter` | Body: 157 | Body: 126 | Body: 0.004600 |
| `mouthUpperLipMiddleUp` | Body: 158 | Body: 116 | Body: 0.003600 |
| `mouthUpperLipMiddleDown` | Body: 159 | Body: 91 | Body: 0.002302 |
| `mouthLowerLipMiddleUp` | Body: 160 | Body: 58 | Body: 0.005001 |
| `mouthLowerLipMiddleDown` | Body: 161 | Body: 46 | Body: 0.002746 |
| `mouthCupidsBowWider` | Body: 162 | Body: 80 | Body: 0.002202 |
| `mouthCupidsBowNarrower` | Body: 163 | Body: 99 | Body: 0.001811 |
| `mouthPhiltrumDeeper` | Body: 164 | Body: 15 | Body: 0.002532 |
| `mouthPhiltrumShallower` | Body: 165 | Body: 25 | Body: 0.002309 |
| `mouthLaughLines` | Body: 166 | Body: 60 | Body: 0.003685 |
| `mouthHigher` | Body: 167; Teeth: 21; Tongue: 17 | Body: 627; Teeth: 136; Tongue: 253 | Body: 0.006478; Teeth: 0.006478; Tongue: 0.006478 |
| `mouthLower` | Body: 168; Teeth: 22; Tongue: 18 | Body: 708; Teeth: 136; Tongue: 253 | Body: 0.009101; Teeth: 0.008800; Tongue: 0.008800 |
| `earTallerLeft` | Body: 169 | Body: 403 | Body: 0.008700 |
| `earTallerRight` | Body: 170 | Body: 403 | Body: 0.008700 |
| `earShorterLeft` | Body: 171 | Body: 403 | Body: 0.008700 |
| `earShorterRight` | Body: 172 | Body: 403 | Body: 0.008700 |
| `earRoundLeft` | Body: 173 | Body: 381 | Body: 0.008515 |
| `earRoundRight` | Body: 174 | Body: 381 | Body: 0.008515 |
| `earSquareLeft` | Body: 175 | Body: 198 | Body: 0.007965 |
| `earSquareRight` | Body: 176 | Body: 198 | Body: 0.007965 |
| `earTriangleLeft` | Body: 177 | Body: 270 | Body: 0.019059 |
| `earTriangleRight` | Body: 178 | Body: 270 | Body: 0.019059 |
| `earLobeSmallerLeft` | Body: 179 | Body: 39 | Body: 0.007111 |
| `earLobeSmallerRight` | Body: 180 | Body: 39 | Body: 0.007111 |
| `earFlapMoreLeft` | Body: 181 | Body: 283 | Body: 0.016601 |
| `earFlapMoreRight` | Body: 182 | Body: 283 | Body: 0.016601 |
| `earTiltForwardLeft` | Body: 183 | Body: 444 | Body: 0.007879 |
| `earTiltForwardRight` | Body: 184 | Body: 444 | Body: 0.007879 |
| `earTiltBackLeft` | Body: 185 | Body: 422 | Body: 0.010288 |
| `earTiltBackRight` | Body: 186 | Body: 422 | Body: 0.010288 |
| `eyeHigherLeft` | Body: 187; Eyes: 18 | Body: 503; Eyes: 80 | Body: 0.006100; Eyes: 0.006100 |
| `eyeHigherRight` | Body: 188; Eyes: 19 | Body: 490; Eyes: 80 | Body: 0.006100; Eyes: 0.006100 |
| `eyeLowerLeft` | Body: 189; Eyes: 20 | Body: 488; Eyes: 80 | Body: 0.002900; Eyes: 0.002900 |
| `eyeLowerRight` | Body: 190; Eyes: 21 | Body: 470; Eyes: 80 | Body: 0.002900; Eyes: 0.002900 |
| `eyeInnerUpLeft` | Body: 191 | Body: 138 | Body: 0.001825 |
| `eyeInnerUpRight` | Body: 192 | Body: 126 | Body: 0.001825 |
| `eyeInnerDownLeft` | Body: 193 | Body: 155 | Body: 0.002102 |
| `eyeInnerDownRight` | Body: 194 | Body: 142 | Body: 0.002100 |
| `eyeUpperLidUpLeft` | Body: 195 | Body: 164 | Body: 0.003000 |
| `eyeUpperLidUpRight` | Body: 196 | Body: 151 | Body: 0.003000 |
| `eyeUpperLidDownLeft` | Body: 197 | Body: 107 | Body: 0.001552 |
| `eyeUpperLidDownRight` | Body: 198 | Body: 91 | Body: 0.001552 |
| `eyeLowerLidUpLeft` | Body: 199 | Body: 408 | Body: 0.003400 |
| `eyeLowerLidUpRight` | Body: 200 | Body: 408 | Body: 0.003400 |
| `eyeLowerLidDownLeft` | Body: 201 | Body: 235 | Body: 0.002200 |
| `eyeLowerLidDownRight` | Body: 202 | Body: 204 | Body: 0.002200 |
| `eyeFoldUpLeft` | Body: 203 | Body: 24 | Body: 0.002102 |
| `eyeFoldUpRight` | Body: 204 | Body: 24 | Body: 0.002102 |
| `eyeFoldDownLeft` | Body: 205 | Body: 54 | Body: 0.003951 |
| `eyeFoldDownRight` | Body: 206 | Body: 54 | Body: 0.003951 |
| `eyeEpicanthusInLeft` | Body: 207 | Body: 63 | Body: 0.003053 |
| `eyeEpicanthusInRight` | Body: 208 | Body: 63 | Body: 0.003053 |
| `eyeEpicanthusOutLeft` | Body: 209 | Body: 77 | Body: 0.007870 |
| `eyeEpicanthusOutRight` | Body: 210 | Body: 76 | Body: 0.007870 |
| `eyeDeepSetLeft` | Body: 211 | Body: 274 | Body: 0.003821 |
| `eyeDeepSetRight` | Body: 212 | Body: 258 | Body: 0.003821 |
| `eyeProtrudingLeft` | Body: 213 | Body: 283 | Body: 0.004082 |
| `eyeProtrudingRight` | Body: 214 | Body: 274 | Body: 0.004082 |
| `browsForward` | Body: 215 | Body: 292 | Body: 0.016408 |
| `browsBackward` | Body: 216 | Body: 177 | Body: 0.004510 |
| `cheekFlatterLeft` | Body: 217 | Body: 84 | Body: 0.002581 |
| `cheekFlatterRight` | Body: 218 | Body: 84 | Body: 0.002581 |
| `cheekInnerFullerLeft` | Body: 219 | Body: 96 | Body: 0.008201 |
| `cheekInnerFullerRight` | Body: 220 | Body: 101 | Body: 0.008201 |
| `cheekInnerHollowLeft` | Body: 221 | Body: 41 | Body: 0.002864 |
| `cheekInnerHollowRight` | Body: 222 | Body: 41 | Body: 0.002864 |
| `cheekHigherLeft` | Body: 223 | Body: 80 | Body: 0.007671 |
| `cheekHigherRight` | Body: 224 | Body: 80 | Body: 0.007671 |
| `cheekLowerLeft` | Body: 225 | Body: 172 | Body: 0.006600 |
| `cheekLowerRight` | Body: 226 | Body: 172 | Body: 0.006600 |
| `jawBonesStronger` | Body: 227 | Body: 597 | Body: 0.013986 |
| `jawBonesSofter` | Body: 228; Eyes: 22; Teeth: 23; Tongue: 19 | Body: 200; Eyes: 0; Teeth: 0; Tongue: 0 | Body: 0.008511; Eyes: 0.000000; Teeth: 0.000000; Tongue: 0.000000 |
| `jawChinProminent` | Body: 229 | Body: 108 | Body: 0.011900 |
| `jawChinRecessed` | Body: 230; Teeth: 24 | Body: 182; Teeth: 7 | Body: 0.009100; Teeth: 0.001910 |
| `jawDrop` | Body: 231 | Body: 42 | Body: 0.005632 |
| `jawChinCleftLess` | Body: 232 | Body: 21 | Body: 0.003447 |
| `headTriangular` | Body: 233 | Body: 598 | Body: 0.013254 |
| `headInvertedTriangular` | Body: 234 | Body: 2021 | Body: 0.008006 |
| `headRectangular` | Body: 235 | Body: 484 | Body: 0.014603 |
| `headDiamond` | Body: 236 | Body: 550 | Body: 0.016905 |
| `headFuller` | Body: 237 | Body: 769 | Body: 0.014234 |
| `headLeaner` | Body: 238 | Body: 790 | Body: 0.007432 |
| `headAged` | Body: 239; Eyes: 23; Teeth: 25; Tongue: 20 | Body: 2670; Eyes: 0; Teeth: 14; Tongue: 0 | Body: 0.003276; Eyes: 0.000000; Teeth: 0.000583; Tongue: 0.000000 |
| `headYouthful` | Body: 240; Eyes: 24; Teeth: 26; Tongue: 21 | Body: 3451; Eyes: 0; Teeth: 136; Tongue: 248 | Body: 0.005460; Eyes: 0.000000; Teeth: 0.003426; Tongue: 0.002737 |
| `headBackDeeper` | Body: 241 | Body: 404 | Body: 0.029838 |
| `headBackFlatter` | Body: 242 | Body: 400 | Body: 0.027122 |
| `foreheadTaller` | Body: 243 | Body: 146 | Body: 0.037900 |
| `foreheadShorter` | Body: 244 | Body: 146 | Body: 0.021800 |
| `foreheadForward` | Body: 245 | Body: 252 | Body: 0.014401 |
| `foreheadBackward` | Body: 246 | Body: 174 | Body: 0.015075 |
| `foreheadTemplesWider` | Body: 247 | Body: 258 | Body: 0.006503 |
| `foreheadTemplesNarrower` | Body: 248 | Body: 90 | Body: 0.008100 |
| `neckBackDeeper` | Body: 249 | Body: 198 | Body: 0.011994 |
| `neckBackFlatter` | Body: 250 | Body: 280 | Body: 0.018430 |
| `neckDoubleChin` | Body: 251 | Body: 209 | Body: 0.013223 |
| `neckDoubleChinLess` | Body: 252 | Body: 177 | Body: 0.013967 |
| `neckForward` | Body: 253 | Body: 679 | Body: 0.020000 |
| `neckBackward` | Body: 254 | Body: 877 | Body: 0.020000 |
| `chestShallower` | Body: 255 | Body: 1753 | Body: 0.017400 |
| `chestTaller` | Body: 256; Eyes: 25; Teeth: 27; Tongue: 22 | Body: 10559; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.102800; Eyes: 0.102800; Teeth: 0.102800; Tongue: 0.102800 |
| `chestShorter` | Body: 257; Eyes: 26; Teeth: 28; Tongue: 23 | Body: 10745; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.043100; Eyes: 0.043100; Teeth: 0.043100; Tongue: 0.043100 |
| `chestVShapeLess` | Body: 258 | Body: 5554 | Body: 0.026700 |
| `chestPectoralsLess` | Body: 259 | Body: 456 | Body: 0.006500 |
| `torsoLatsWider` | Body: 260 | Body: 502 | Body: 0.028239 |
| `torsoLatsNarrower` | Body: 261 | Body: 502 | Body: 0.028239 |
| `torsoFrontChestWider` | Body: 262 | Body: 502 | Body: 0.022639 |
| `torsoFrontChestNarrower` | Body: 263 | Body: 586 | Body: 0.014800 |
| `torsoUnderbustWider` | Body: 264 | Body: 1156 | Body: 0.026101 |
| `torsoUnderbustNarrower` | Body: 265 | Body: 1115 | Body: 0.008682 |
| `hipsCircWider` | Body: 266 | Body: 738 | Body: 0.036145 |
| `hipsCircNarrower` | Body: 267 | Body: 722 | Body: 0.018025 |
| `hipsDeeper` | Body: 268 | Body: 1236 | Body: 0.037100 |
| `hipsTaller` | Body: 269 | Body: 1126 | Body: 0.035800 |
| `hipsShorter` | Body: 270 | Body: 1126 | Body: 0.035800 |
| `hipsWaistUp` | Body: 271 | Body: 535 | Body: 0.034500 |
| `hipsWaistDown` | Body: 272 | Body: 961 | Body: 0.059813 |
| `bellySmaller` | Body: 273 | Body: 140 | Body: 0.015580 |
| `bellySoft` | Body: 274 | Body: 199 | Body: 0.044486 |
| `bellyNavelUp` | Body: 275 | Body: 159 | Body: 0.028200 |
| `bellyNavelDown` | Body: 276 | Body: 159 | Body: 0.037700 |
| `armsUpperWider` | Body: 277 | Body: 4472 | Body: 0.072119 |
| `armsUpperNarrower` | Body: 278 | Body: 4484 | Body: 0.041064 |
| `armsLowerWider` | Body: 279 | Body: 4064 | Body: 0.064899 |
| `armsLowerNarrower` | Body: 280 | Body: 4062 | Body: 0.051417 |
| `armsUpperDeeper` | Body: 281 | Body: 546 | Body: 0.013300 |
| `armsLowerDeeper` | Body: 282 | Body: 638 | Body: 0.010882 |
| `armsUpperTaller` | Body: 283 | Body: 422 | Body: 0.013700 |
| `armsLowerTaller` | Body: 284 | Body: 668 | Body: 0.015290 |
| `armsLessMuscular` | Body: 285 | Body: 874 | Body: 0.012037 |
| `armsShouldersLessMuscular` | Body: 286 | Body: 100 | Body: 0.014223 |
| `legsThighsWider` | Body: 287 | Body: 658 | Body: 0.028211 |
| `legsThighsNarrower` | Body: 288 | Body: 522 | Body: 0.021708 |
| `legsCalvesWider` | Body: 289 | Body: 680 | Body: 0.012100 |
| `legsCalvesNarrower` | Body: 290 | Body: 620 | Body: 0.016900 |
| `legsThighsDeeper` | Body: 291 | Body: 526 | Body: 0.024900 |
| `legsCalvesDeeper` | Body: 292 | Body: 878 | Body: 0.021000 |
| `legsKneesIn` | Body: 293 | Body: 998 | Body: 0.046251 |
| `legsKneesOut` | Body: 294 | Body: 1252 | Body: 0.051803 |
| `calvesThicker` | Body: 295 | Body: 456 | Body: 0.020743 |
| `calvesThinner` | Body: 296 | Body: 330 | Body: 0.012646 |
| `thighsLessMuscular` | Body: 297 | Body: 594 | Body: 0.016654 |
| `calvesLessMuscular` | Body: 298 | Body: 332 | Body: 0.016774 |
| `legsUpperLonger` | Body: 299 | Body: 3538 | Body: 0.106885 |
| `legsUpperShorter` | Body: 300 | Body: 3696 | Body: 0.075011 |
| `legsLowerLonger` | Body: 301 | Body: 2900 | Body: 0.081154 |
| `legsLowerShorter` | Body: 302 | Body: 2950 | Body: 0.059000 |
| `bodyAfrican` | Body: 303; Eyes: 27; Teeth: 29; Tongue: 24 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.099486; Eyes: 0.088255; Teeth: 0.090900; Tongue: 0.101335 |
| `bodyAsian` | Body: 304; Eyes: 28; Teeth: 30; Tongue: 25 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.125952; Eyes: 0.089303; Teeth: 0.095173; Tongue: 0.093857 |
| `bodyCaucasian` | Body: 305; Eyes: 29; Teeth: 31; Tongue: 26 | Body: 14517; Eyes: 160; Teeth: 136; Tongue: 253 | Body: 0.066915; Eyes: 0.024265; Teeth: 0.029292; Tongue: 0.042108 |

## Resultado de la Fase 1

Hay morphs corporales reales que permiten evaluar la Fase 2 sobre el modelo existente. Se conserva human.glb íntegro. No se implementaron controlador, presets, UI, persistencia corporal, correctivos, iluminación ni cambios de materiales en esta fase. La auditoría superficial y la revisión de las 20 poses se realizarán en sus fases correspondientes, previa aprobación.
