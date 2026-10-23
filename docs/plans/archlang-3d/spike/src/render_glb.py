"""blender -b --factory-startup --python-exit-code 1 -P render_glb.py -- in.glb out.png [iso|top] [spp]"""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, out, view = a[0], a[1], (a[2] if len(a) > 2 else 'iso'); spp = int(a[3]) if len(a) > 3 else 16
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
objs = [o for o in sc.objects if o.type == 'MESH']
lo = Vector((1e9,)*3); hi = Vector((-1e9,)*3)
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
ctr = (lo + hi) / 2; size = hi - lo
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.92, 0.95, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.5; sun.rotation_euler = (math.radians(50), 0, math.radians(35))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
if view == 'top':
    cam.location = (ctr.x, ctr.y, hi.z + 20); cam.rotation_euler = (0, 0, 0); cam.data.ortho_scale = max(size.x, size.y) * 1.08
    for o in objs:
        if o.name.startswith('roof'): o.hide_render = True
else:
    d = Vector((1, -1, 0.9)).normalized(); cam.location = ctr + d * 40
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = max(size.x, size.y) * 1.5
    for o in objs:
        if o.name.startswith('roof'): o.hide_render = True   # cut-away: no roof so the interior reads
sc.render.engine = 'CYCLES'; sc.cycles.samples = spp; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 1000, 800; sc.render.filepath = out; sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
