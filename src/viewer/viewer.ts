import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Pose } from '../catalog/poses';

export class PoseViewer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private root = new THREE.Group();
  private bones: THREE.Mesh[] = [];
  private joints: THREE.Mesh[] = [];
  private torso: THREE.Mesh;
  private pelvis: THREE.Mesh;
  private head: THREE.Mesh;
  private neck: THREE.Mesh;
  private floor: THREE.Mesh;
  private seat = new THREE.Group();
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private disposed = false;

  constructor(private readonly mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.28;
    mount.append(this.renderer.domElement); this.scene.background = new THREE.Color('#eee8df');
    this.camera.position.set(0, 2.4, 7.2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.target.set(0, 1.12, 0); this.controls.enableDamping = true; this.controls.minDistance = 4.2; this.controls.maxDistance = 10; this.controls.maxPolarAngle = Math.PI * .88; this.controls.minPolarAngle = .25;
    this.scene.add(new THREE.HemisphereLight('#fff8ee', '#78675e', 2.05));
    const key = new THREE.DirectionalLight('#fffaf3', 3.0); key.position.set(-3.5, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-4; key.shadow.camera.right=4; key.shadow.camera.top=6; key.shadow.camera.bottom=-3; this.scene.add(key);
    const fill = new THREE.DirectionalLight('#d4dce0', 1.1); fill.position.set(4,2,-4); this.scene.add(fill);
    const groundMat = new THREE.MeshStandardMaterial({ color:'#d8d0c5', roughness:.9 });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(5.5, 64), groundMat); this.floor.rotation.x = -Math.PI/2; this.floor.position.y = -.035; this.floor.receiveShadow = true; this.scene.add(this.floor);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.56, 64), new THREE.MeshStandardMaterial({ color:'#c6b9ab', roughness:.85 })); disc.rotation.x=-Math.PI/2; disc.position.y=-.024; disc.receiveShadow=true; this.scene.add(disc);
    const seatMat = new THREE.MeshStandardMaterial({ color:'#8f8b82', roughness:.9 });
    const seatTop = new THREE.Mesh(new THREE.BoxGeometry(.72,.07,.56),seatMat);seatTop.position.set(0,.62,-.17);seatTop.castShadow=true;seatTop.receiveShadow=true;this.seat.add(seatTop);
    for(const x of [-.28,.28])for(const z of [-.38,.04]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.58,8),seatMat);leg.position.set(x,.3,z);leg.castShadow=true;this.seat.add(leg);}
    this.seat.visible=false;this.scene.add(this.seat);
    const clay = new THREE.MeshStandardMaterial({ color:'#b96e53', roughness:.72 });
    this.torso = this.sphere(clay, [.34,.47,.20]); this.pelvis = this.sphere(clay,[.27,.22,.19]); this.head=this.sphere(clay,[.15,.19,.15]); this.neck=this.sphere(clay,[.09,.14,.09]);
    this.root.add(this.torso,this.pelvis,this.head,this.neck);
    for(let i=0;i<16;i++) { const joint=this.sphere(clay,[i%8===3?.09:.075,i%8===3?.09:.075,i%8===3?.09:.075]); this.root.add(joint); this.joints.push(joint); }
    for(let i=0;i<10;i++){ const radius=i%5===2||i%5===3?.105:.082; const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,.75,5,10),clay); mesh.castShadow=true; mesh.receiveShadow=true; this.root.add(mesh); this.bones.push(mesh); }
    this.root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}}); this.scene.add(this.root);
    this.resizeObserver = new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(mount); this.resize(); this.render();
  }
  private sphere(mat: THREE.Material, scale: [number,number,number]) { const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),mat); m.scale.set(...scale); return m; }
  private resize(){const w=Math.max(1,this.mount.clientWidth),h=Math.max(1,this.mount.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  private render=()=>{if(this.disposed)return;this.controls.update();this.renderer.render(this.scene,this.camera);this.animationFrame=requestAnimationFrame(this.render);};
  setCamera(name:string){const positions:Record<string,THREE.Vector3>={Frontal:new THREE.Vector3(0,2.4,7.2), 'Tres cuartos':new THREE.Vector3(4.7,2.4,5.5), Lateral:new THREE.Vector3(7.2,2.4,0), Posterior:new THREE.Vector3(0,2.4,-7.2), Aleatoria:new THREE.Vector3(0,2.4,7.2)};const p=positions[name]??positions.Frontal!;this.camera.position.copy(p);this.controls.target.set(0,1.12,0);this.controls.update();}
  randomCamera(){const names=['Frontal','Tres cuartos','Lateral','Posterior'];this.setCamera(names[Math.floor(Math.random()*names.length)]!);}
  reset(){this.setCamera('Frontal');}
  setTheme(dark:boolean){this.scene.background=new THREE.Color(dark?'#252725':'#eee8df');(this.floor.material as THREE.MeshStandardMaterial).color.set(dark?'#333633':'#d8d0c5');}
  apply(p:Pose){
    const seated=p.category==='Sentada', low=p.category==='Agachada';
    this.seat.visible=seated;
    const hipHeight=seated?.72:low?Math.max(.5,1.02-(p.crouch??0)*.75):1.02;
    const hip=new THREE.Vector3(p.twist?Math.sin(p.twist*Math.PI/180)*.13:0,hipHeight,0);
    const lean=(p.lean??0)*Math.PI/180, shoulder=new THREE.Vector3(hip.x+Math.sin(lean)*.55,hip.y+.64-(low?(p.crouch??0)*.12:0),Math.sin((p.twist??0)*Math.PI/180)*.13);
    const head=new THREE.Vector3(shoulder.x+Math.sin(lean)*.18,shoulder.y+.46,shoulder.z);
    this.pelvis.position.copy(hip);this.torso.position.copy(hip.clone().lerp(shoulder,.52));this.torso.rotation.z=-lean;this.torso.rotation.y=(p.twist??0)*Math.PI/180*.45;this.head.position.copy(head);this.neck.position.copy(shoulder.clone().lerp(head,.48));
    const points:THREE.Vector3[]=[];const segments:Array<[THREE.Vector3,THREE.Vector3]>=[];
    for(let side=0;side<2;side++){
      const sign=side===0?-1:1, shoulderPoint=new THREE.Vector3(shoulder.x+sign*.3,shoulder.y,shoulder.z), armA=(p.arms[side]??0)*Math.PI/180, elbowA=armA+(p.elbows[side]??0)*Math.PI/180;
      const elbow=shoulderPoint.clone().add(new THREE.Vector3(Math.sin(armA)*.38,-Math.cos(armA)*.38,Math.sin((p.depth??0)*Math.PI/180)*.14));
      const wrist=elbow.clone().add(new THREE.Vector3(Math.sin(elbowA)*.34,-Math.cos(elbowA)*.34,.025));
      const hand=wrist.clone().add(new THREE.Vector3(Math.sin(elbowA)*.12,-Math.cos(elbowA)*.12,.015));
      const hipPoint=hip.clone().add(new THREE.Vector3(sign*.15,-.08,0)), legA=(p.legs[side]??0)*Math.PI/180, kneeA=legA+(p.knees[side]??0)*Math.PI/180;
      let knee:THREE.Vector3, ankle:THREE.Vector3;
      if(seated){
        const spread=sign*(p.id==='14'?.05:.16);
        knee=new THREE.Vector3(hip.x+spread,hip.y-.17,.47+(side===1&&p.id==='12'?.12:0));
        ankle=new THREE.Vector3(knee.x+(side===0?-.035:.035),.085,knee.z+(p.id==='14'&&side===0?-.28:.07));
      }else if(low){
        knee=new THREE.Vector3(hip.x+sign*.33,Math.max(.28,hip.y-.24),.28);
        ankle=new THREE.Vector3(hip.x+sign*.34,.085,p.id==='16'&&side===1?-.25:.22);
      }else{
        knee=hipPoint.clone().add(new THREE.Vector3(Math.sin(legA)*.47,-Math.cos(legA)*.47,.04+Math.abs(Math.sin(legA))*.17));
        ankle=knee.clone().add(new THREE.Vector3(Math.sin(kneeA)*.42,-Math.cos(kneeA)*.42,.01));
        if(p.id==='05'&&side===1)ankle.y+=.26;
      }
      const toe=ankle.clone().add(new THREE.Vector3(sign*.06,.015,.22));
      segments.push([shoulderPoint,elbow],[elbow,wrist],[hipPoint,knee],[knee,ankle],[ankle,toe]);points.push(shoulderPoint,elbow,wrist,hand,hipPoint,knee,ankle,toe);
    }
    segments.forEach((s,i)=>this.placeBone(this.bones[i]!,s[0],s[1]));
    points.forEach((v,i)=>{if(this.joints[i])this.joints[i]!.position.copy(v);});
    this.root.position.y=0;
  }
  private placeBone(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){const mid=a.clone().add(b).multiplyScalar(.5),delta=b.clone().sub(a);mesh.position.copy(mid);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());mesh.scale.set(1,Math.max(.12,delta.length()-.08),1);}
  dispose(){this.disposed=true;cancelAnimationFrame(this.animationFrame);this.resizeObserver.disconnect();this.controls.dispose();this.renderer.dispose();this.mount.replaceChildren();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();this.scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);if(Array.isArray(o.material))o.material.forEach(m=>materials.add(m));else materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
}
