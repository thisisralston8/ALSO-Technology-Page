/* The few parts of three.js the isometric platform uses, so a build only
   carries those (importing 'three' as a whole can't be trimmed). The platform
   loads this on demand, as the section approaches. Add a name here if
   platform.js starts using another `THREE.*`. */
export {
  AdditiveBlending, Camera, Color, DoubleSide, DynamicDrawUsage, Group,
  InstancedBufferAttribute, InstancedMesh, LinearSRGBColorSpace, Matrix4, Mesh,
  NormalBlending, PerspectiveCamera, PlaneGeometry, Quaternion, SRGBColorSpace,
  Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three';
