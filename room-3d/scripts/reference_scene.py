"""Reconstructed meshes from the supplied recording; dimensions in scene units.

All furniture silhouettes are authored here, independently of the earlier blockout.
Reusable primitive/UV/export helpers live in build_qianyu_room.py.
"""
import math
import bpy
from mathutils import Vector


def build(api):
    global box, cyl, curve, torus, sphere, cone, M, tag
    box, cyl, curve = api['add_box'], api['add_cylinder'], api['add_curve']
    torus, sphere, cone = api['add_torus'], api['add_uv_sphere'], api['add_cone']
    M, tag = api['M'], api['tag']
    make = api['material']
    M['anodized'] = make('anodized', (.035, .039, .040, 1), .32, .65)
    M['rubber'] = make('rubber', (.009, .010, .011, 1), .83)
    M['chrome'] = make('chrome', (.48, .49, .50, 1), .23, .85)
    M['lens'] = make('lens', (.008, .026, .022, 1), .12, .48)
    M['oak'] = make('oak', (.36, .20, .095, 1), .62)
    # Very subtle procedural grain is baked below, rather than shipped as an unsupported shader.
    oak = M['oak'].node_tree
    tex = oak.nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = 5
    coord = oak.nodes.new('ShaderNodeTexCoord')
    mapping = oak.nodes.new('ShaderNodeVectorMath'); mapping.operation = 'MULTIPLY'
    mapping.inputs[1].default_value = (9, 9, .28)
    oak.links.new(coord.outputs['Generated'], mapping.inputs[0]); oak.links.new(mapping.outputs[0], tex.inputs['Vector'])
    ramp = oak.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.21, .103, .035, 1)
    ramp.color_ramp.elements[1].color = (.47, .30, .145, 1)
    oak.links.new(tex.outputs['Fac'], ramp.inputs[0]); oak.links.new(ramp.outputs[0], oak.nodes.get('Principled BSDF').inputs['Base Color'])
    room(api)
    desk()
    laptop()
    camera()
    record_player()
    chair()
    lamps()
    guitar()
    wall(api)


def rod(name, a, b, radius, material, group='detail', interaction=None):
    a, b = Vector(a), Vector(b)
    obj = cyl(name, (a+b)/2, radius, (b-a).length, material, vertices=16, group=group, interaction=interaction)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def mesh(name, vertices, faces, material, group, interaction=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for face in data.polygons: face.use_smooth = True
    return tag(obj, interaction, group)


def room(api):
    box('studio_floor', (0, 0, -.09), (100, 100, .16), M['floor'], bevel=0)
    box('studio_wall', (0, 3.65, 25), (100, .15, 50), M['wall'], bevel=0)


def desk():
    box('desk_top', (0, .9, 2.94), (7.4, 2.55, .125), M['cream'], bevel=.018, group='desk')
    box('desk_underframe', (0, .9, 2.84), (6.95, 2.24, .08), M['paper'], bevel=.01, group='desk')
    # Open rectangular end frames, a conspicuous feature in the recording.
    for x in (-3.30, 3.30):
        for y in (-.12, 1.92):
            box('desk_u_upright', (x,y,1.48), (.14,.17,2.82), M['oak'], bevel=.012, group='desk')
            cyl('desk_fastener', (x-.073,y,2.65), .027,.008,M['metal'],vertices=12,rotation=(0,math.pi/2,0),group='desk')
        box('desk_u_foot', (x,.9,.13), (.14,2.20,.14), M['oak'], bevel=.012, group='desk')
        for y in (-.12,1.92):
            box('desk_floor_pad', (x,y,.05), (.13,.16,.02), M['rubber'],bevel=.008,group='desk')
    box('research_paper_00', (-1.35,.55,3.015), (1.02,1.24,.013),M['paper'],bevel=.004,interaction='paper',group='paper',rotation=(0,0,-.08))
    rod('pen_barrel',(-1.20,.22,3.04),(-1.16,.93,3.04),.020,M['anodized'],'paper','paper')
    rod('pen_tip',(-1.20,.15,3.04),(-1.20,.23,3.04),.009,M['chrome'],'paper')
    rod('pen_clip',(-1.135,.74,3.055),(-1.125,.91,3.055),.005,M['chrome'],'paper')


def laptop():
    x,y,z=.05,.88,3.038
    box('macbook_air_base',(x,y,z),(1.50,1.01,.039),M['anodized'],bevel=.021,interaction='cv',group='computer')
    box('macbook_air_deck',(x,y,z+.022),(1.44,.95,.011),M['anodized'],bevel=.012,group='computer')
    box('macbook_air_trackpad',(x,y-.26,z+.030),(.56,.30,.0025),M['metal'],bevel=.013,group='computer')
    for row in range(5):
        for col in range(13):
            box('key', (x-.59+col*.098,y+.04+row*.092,z+.033),(.075,.069,.008),M['rubber'],bevel=.007,group='computer')
    box('spacebar',(x,y-.044,z+.033),(.40,.064,.008),M['rubber'],bevel=.008,group='computer')
    for side in (-1,1):
        for i in range(12):
            box('speaker_slot',(x+side*.682,y+.04+i*.029,z+.029),(.018,.008,.002),M['ink'],bevel=0,group='computer')
        for i in range(2):
            box('usb_port',(x+side*.751,y+.16+i*.14,z),(.003,.075,.012),M['ink'],bevel=.004,group='computer')
    rod('macbook_air_hinge',(-.60,1.36,3.07),(.70,1.36,3.07),.023,M['rubber'],'computer')
    # Lid layers share the same local transform, preventing floating screen decorations.
    angle=math.radians(-12)
    origin=Vector((x,1.36,3.08))
    def lid(name, w, h, depth, forward, mat, interaction=None):
        loc=origin+Vector((0,math.sin(-angle)*h/2+forward,math.cos(angle)*h/2))
        return box(name,loc,(w,depth,h),mat,bevel=.014,interaction=interaction,group='computer',rotation=(angle,0,0))
    lid('macbook_air_lid',1.49,.97,.024,0,M['anodized'],'cv')
    lid('macbook_air_bezel',1.435,.925,.009,-.018,M['rubber'])
    lid('macbook_air_screen',1.37,.846,.003,-.025,M['screen'],'cv')
    box('webcam',(.05,1.523,3.980),(.023,.006,.008),M['lens'],bevel=.003,group='computer')


def camera():
    x,y,z=-2.29,.57,3.22
    box('camera_body',(x,y,z),(.67,.29,.39),M['rubber'],bevel=.019,interaction='photos',group='camera')
    box('camera_top',(x,y,z+.197),(.69,.30,.045),M['metal'],bevel=.011,group='camera')
    box('camera_bottom',(x,y,z-.185),(.68,.29,.024),M['anodized'],bevel=.009,group='camera')
    box('camera_grip',(x+.29,y-.02,z),(.13,.34,.35),M['rubber'],bevel=.031,group='camera')
    box('camera_viewfinder',(x+.13,y-.15,z+.12),(.075,.014,.062),M['lens'],bevel=.003,group='camera')
    box('camera_rangefinder',(x-.23,y-.15,z+.12),(.10,.014,.047),M['lens'],bevel=.003,group='camera')
    for i in range(5):
        cyl('camera_lens_segment',(x-.06,y-.19-i*.030,z-.015),.14-i*.003,.038,M['anodized'] if i%2 else M['metal'],vertices=64,rotation=(math.pi/2,0,0),group='camera')
    cyl('camera_lens_glass',(x-.06,y-.34,z-.015),.101,.006,M['lens'],vertices=64,rotation=(math.pi/2,0,0),group='camera')
    for i in range(48):
        a=i*math.tau/48
        box('lens_knurl',(x-.06+math.cos(a)*.141,y-.235,z-.015+math.sin(a)*.141),(.007,.046,.007),M['rubber'],bevel=.001,group='camera')
    for dx,r in ((-.24,.063),(.23,.049)):
        cyl('camera_dial',(x+dx,y,z+.24),r,.035,M['anodized'],vertices=32,group='camera')
        for i in range(12):
            a=i*math.tau/12
            cyl('dial_knurl',(x+dx+r*math.cos(a),y+r*math.sin(a),z+.24),.003,.03,M['metal'],vertices=8,group='camera')
    for dx in (-.35,.35):
        obj=torus('camera_strap_lug',(x+dx,y-.025,z+.13),.025,.005,M['chrome'],group='camera'); obj.rotation_euler=(math.pi/2,0,0)
    cyl('film_canister',(-2.86,.55,3.125),.071,.23,M['gold'],vertices=32,interaction='photos',group='camera')
    for zcap in (3.014,3.241): cyl('film_cap',(-2.86,.55,zcap),.078,.020,M['rubber'],vertices=32,group='camera')
    box('film_leader',(-2.97,.56,3.10),(.09,.06,.16),M['ink'],bevel=.003,group='camera')


def record_player():
    x,y=2.25,1.02
    box('turntable_body',(x,y,3.105),(2.08,1.55,.19),M['anodized'],bevel=.022,interaction='music',group='music')
    box('turntable_top',(x,y,3.206),(2.02,1.49,.020),M['rubber'],bevel=.012,group='music')
    for dx in (-.84,.84):
        for dy in (-.58,.58): cyl('turntable_foot',(x+dx,y+dy,3.006),.075,.036,M['rubber'],vertices=24,group='music')
    cx,cy=x-.30,y-.01
    cyl('turntable_platter',(cx,cy,3.255),.61,.055,M['anodized'],vertices=96,group='music')
    cyl('vinyl',(cx,cy,3.289),.575,.010,M['vinyl'],vertices=96,interaction='music',group='record')
    cyl('vinyl_label',(cx,cy,3.296),.19,.003,M['red'],vertices=48,interaction='music',group='record')
    box('vinyl_label_mark',(cx+.05,cy,3.299),(.14,.018,.002),M['paper'],bevel=0,interaction='music',group='record')
    for i in range(26): torus('vinyl_groove',(cx,cy,3.295),.235+i*.012,.0012,M['anodized'],interaction='music',group='record')
    cyl('turntable_spindle',(cx,cy,3.32),.017,.06,M['chrome'],vertices=20,group='music')
    cyl('tonearm_base',(x+.73,y+.44,3.29),.115,.14,M['anodized'],vertices=32,group='music')
    rod('tonearm_counterweight',(x+.74,y+.38,3.40),(x+.80,y+.65,3.40),.069,M['metal'],'music')
    curve('turntable_needle',[(x+.74,y+.42,3.43),(x+.58,y+.13,3.42),(x+.40,y-.24,3.34)],.014,M['chrome'],group='music')
    box('tonearm_head',(x+.39,y-.29,3.335),(.085,.15,.032),M['rubber'],bevel=.006,group='music',rotation=(0,0,-.35))
    rod('needle_tip',(x+.37,y-.33,3.325),(x+.37,y-.33,3.296),.004,M['chrome'],'music')
    for dx in (-.82,.82):
        cyl('turntable_button',(x+dx,y-.58,3.23),.038,.018,M['metal'],vertices=24,group='music')
    for dx in (-.72,.72): box('lid_hinge',(x+dx,y+.76,3.22),(.13,.12,.08),M['metal'],bevel=.015,group='music')
    # Clear cover with three thin folded edges, rather than an opaque plate.
    box('turntable_dust_lid',(x,y+.88,3.95),(2.06,.013,1.43),M['glass'],bevel=.006,interaction='music',group='music',rotation=(-.15,0,0))
    for dx in (-1.025,1.025): box('lid_edge',(x+dx,y+.84,3.95),(.012,.09,1.42),M['glass'],bevel=.004,group='music',rotation=(-.15,0,0))
    # Headphones lying in front of the deck.
    hx,hy=1.27,-.15
    curve('headphones_band',[(hx-.29,hy,3.10),(hx-.28,hy-.27,3.16),(hx,hy-.36,3.17),(hx+.28,hy-.22,3.16),(hx+.29,hy,3.10)],.036,M['anodized'],interaction='music',group='music')
    for dx in (-.27,.27):
        obj=cyl('headphone_cushion',(hx+dx,hy,3.10),.126,.095,M['rubber'],vertices=40,group='music',rotation=(0,.30 if dx<0 else -.30,0))
        torus('headphone_cushion_seam',(hx+dx,hy,3.15),.102,.009,M['ink'],group='music')


def chair():
    x,y=1.25,-1.60
    # A continuous curved seat/back shell with a narrow waist and flared shoulders.
    profile=[(-.61,1.53,.57),(-.40,1.55,.66),(-.05,1.57,.65),(.27,1.64,.58),(.38,1.85,.48),(.43,2.12,.45),(.50,2.47,.53),(.55,2.86,.67)]
    verts=[]; faces=[]; count=17
    for py,pz,w in profile:
        for i in range(count):
            t=-1+2*i/(count-1)
            verts.append((x+t*w,y+py+(.07*t*t if pz>1.8 else 0),pz+.105*t*t))
    for row in range(len(profile)-1):
        for col in range(count-1):
            a=row*count+col; faces.append((a,a+1,a+1+count,a+count))
    obj=mesh('chair_shell',verts,faces,M['rubber'],'chair','chair')
    sub=obj.modifiers.new('curved_shell','SUBSURF'); sub.levels=2
    thick=obj.modifiers.new('shell_thickness','SOLIDIFY'); thick.thickness=.035
    edge=obj.modifiers.new('shell_edge','BEVEL'); edge.width=.008; edge.segments=2
    for side in (-1,1):
        curve('chair_arm',[(x+side*.49,y-.08,1.62),(x+side*.72,y-.20,1.98),(x+side*.72,y+.14,2.03),(x+side*.49,y+.35,1.80)],.024,M['anodized'],group='chair')
        box('chair_arm_pad',(x+side*.72,y-.02,2.035),(.08,.39,.035),M['rubber'],bevel=.024,group='chair')
    cyl('chair_piston',(x,y,.94),.046,1.15,M['chrome'],vertices=32,group='chair')
    cyl('chair_piston_sleeve',(x,y,.64),.067,.47,M['anodized'],vertices=32,group='chair')
    box('chair_mechanism',(x,y,1.40),(.35,.30,.12),M['ink'],bevel=.02,group='chair')
    rod('chair_adjustment',(x+.1,y,1.4),(x+.53,y-.15,1.40),.016,M['metal'],'chair')
    for i in range(5):
        a=math.tau*i/5+.3
        end=(x+.72*math.cos(a),y+.72*math.sin(a),.24)
        rod('chair_spoke',(x,y,.39),end,.036,M['metal'],'chair')
        for offset in (-.04,.04):
            cyl('chair_castor',(end[0]+offset,end[1],.13),.087,.045,M['rubber'],vertices=24,rotation=(0,math.pi/2,0),group='chair')


def lamps():
    x,y=-2.83,1.43
    cyl('lamp_stand',(x,y,3.032),.27,.045,M['anodized'],vertices=48,interaction='lamp',group='lamp')
    a=(x,y,3.08); b=(x+.03,y,3.60); c=(x-.66,y,4.14); d=(x+.13,y,4.08)
    for name,p,q in [('stem',a,b),('lower',b,c),('upper',c,d)]:
        for offset in (-.024,.024): rod('lamp_'+name,(p[0],p[1]+offset,p[2]),(q[0],q[1]+offset,q[2]),.015,M['anodized'],'lamp','lamp' if name=='stem' else None)
    for p in (b,c,d): cyl('lamp_pivot',p,.043,.075,M['metal'],vertices=24,rotation=(math.pi/2,0,0),group='lamp')
    shade=cone('lamp_shade',(d[0]+.09,y,3.99),.19,.065,.28,M['anodized'],vertices=48,rotation=(0,-.5,0),interaction='lamp',group='lamp')
    cyl('lamp_inner',(d[0]+.16,y,3.86),.16,.008,M['paper'],vertices=40,rotation=(0,-.5,0),group='lamp')
    # Open cylindrical fabric floor shade with visible inside rim.
    x,y=-4.42,.15
    cyl('floor_lamp_base',(x,y,.075),.25,.075,M['anodized'],vertices=48,group='lamp')
    cyl('floor_lamp_stem',(x,y,1.85),.021,3.52,M['metal'],vertices=20,interaction='lamp',group='lamp')
    vs=[]; fs=[]
    for z,r in ((3.48,.37),(4.16,.37),(4.16,.352),(3.48,.352)):
        for i in range(64): vs.append((x+r*math.cos(i*math.tau/64),y+r*math.sin(i*math.tau/64),z))
    for ring in range(4):
        for i in range(64): fs.append((ring*64+i,ring*64+(i+1)%64,((ring+1)%4)*64+(i+1)%64,((ring+1)%4)*64+i))
    mesh('floor_lamp_shade',vs,fs,M['cream'],'lamp','lamp')
    sphere('floor_lamp_bulb',(x,y,3.64),(.07,.07,.10),M['paper'],group='lamp')


def guitar():
    # Double-cut electric guitar profile, not the former pair of acoustic ellipsoids.
    x,y,z=-3.90,.48,.72
    outline=[(-.06,.31),(-.13,.54),(-.21,.56),(-.20,.28),(-.35,.12),(-.39,-.16),(-.31,-.37),(-.10,-.43),(.16,-.41),(.35,-.26),(.37,-.05),(.28,.20),(.23,.50),(.14,.48),(.10,.29)]
    verts=[(x+px,y+depth,z+pz) for depth in (-.10,.10) for px,pz in outline]
    n=len(outline); faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=mesh('guitar_body',verts,faces,M['anodized'],'guitar','guitar')
    bevel=obj.modifiers.new('sculpted_body_edge','BEVEL'); bevel.width=.065; bevel.segments=5
    box('guitar_pickguard',(x+.06,y-.114,z+.03),(.27,.016,.35),M['paper'],bevel=.04,group='guitar')
    box('guitar_neck',(x,y,1.83),(.11,.085,1.58),M['oak'],bevel=.012,group='guitar')
    box('guitar_fretboard',(x,y-.049,1.83),(.091,.015,1.55),M['rubber'],bevel=.006,group='guitar')
    box('guitar_head',(x+.025,y,2.72),(.15,.075,.26),M['oak'],bevel=.035,group='guitar',rotation=(0,-.12,0))
    for i in range(19):
        zz=1.15+1.38*(1-2**(-i/12))
        rod('guitar_fret',(x-.045,y-.061,zz),(x+.045,y-.061,zz),.003,M['chrome'],'guitar')
    for zz in (.69,.83): box('guitar_pickup',(x,y-.14,zz),(.13,.025,.040),M['ink'],bevel=.007,group='guitar')
    box('guitar_bridge',(x,y-.14,.53),(.13,.025,.064),M['chrome'],bevel=.008,group='guitar')
    for i in range(6):
        dx=(i-2.5)*.012
        rod('guitar_string',(x+dx,y-.16,.53),(x+dx,y-.065,2.81),.0016,M['chrome'],'guitar')
        cyl('guitar_tuner',(x+.105,y,2.62+i*.037),.017,.04,M['chrome'],vertices=12,rotation=(0,math.pi/2,0),group='guitar')
    for dx,zz in ((.23,.65),(.25,.53)):
        cyl('guitar_control',(x+dx,y-.13,zz),.022,.02,M['chrome'],vertices=20,rotation=(math.pi/2,0,0),group='guitar')
    rod('guitar_stand',(x,y+.16,.10),(x,y+.16,1.30),.018,M['ink'],'guitar')
    for dx in (-.32,.32): rod('guitar_stand_foot',(x,y+.16,.21),(x+dx,y-.05,.08),.020,M['ink'],'guitar')
    curve('guitar_cable',[(x+.23,y-.13,.5),(x+.40,y-.23,.09),(x+.68,y-.42,.045),(x+.30,y-.68,.045),(x+.10,y-.35,.045)],.009,M['rubber'],group='guitar')


def wall(api):
    x,y,z=-2.88,3.48,5.37
    # Actual curved sheet corner with preserved UVs for live drawing.
    verts=[]; faces=[]; nx,ny=16,20
    for j in range(ny+1):
        for i in range(nx+1):
            u,v=i/nx,j/ny
            curl=max(0,(u-.70)*(1-v/.28)) if v<.28 else 0
            verts.append((x+(u-.5)*2.17,y-curl*.55,z+(v-.5)*2.83+curl*.13))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i; faces.append((a,a+1,a+nx+2,a+nx+1))
    obj=mesh('whiteboard_paper',verts,faces,M['paper'],'research','research')
    uv=obj.data.uv_layers.new(name='UVMap')
    for loop in obj.data.loops:
        idx=loop.vertex_index; uv.data[loop.index].uv=(idx%(nx+1)/nx,idx//(nx+1)/ny)
    obj['preserve_uv']=True
    rod('whiteboard_top_rail',(x-1.15,y,6.83),(x+1.15,y,6.83),.038,M['ink'],'research')
    rod('whiteboard_bottom_rail',(x-1.06,y,3.95),(x+1.06,y-.04,3.95),.013,M['metal'],'research')
    for zz in [4+i*.05 for i in range(56)]: sphere('roller_chain',(x+1.13,y-.01,zz),(.008,.008,.014),M['metal'],group='research')
    box('wall_shelf',(-.10,3.22,5.78),(2.18,.56,.11),M['oak'],bevel=.012,interaction='books',group='books')
    rod('shelf_picture_rail',(-1.2,3.48,6.83),(1.0,3.48,6.83),.026,M['ink'],'books')
    for xleg in (-.80,.6): box('shelf_bracket',(xleg,3.37,5.68),(.10,.25,.14),M['oak'],bevel=.007,group='books')
    for i,(w,h,color) in enumerate(((.13,.72,'ink'),(.11,.80,'rubber'),(.085,.70,'paper'),(.105,.73,'cream'),(.08,.69,'metal'),(.11,.61,'gold'),(.14,.78,'blue'))):
        bx=-.78+i*.18
        box('book_pages',(bx,3.13,5.85+h/2),(w,.29,h-.035),M['paper'],bevel=.003,group='books')
        for side in (-1,1): box('book_cover',(bx+side*(w/2+.008),3.13,5.85+h/2),(.016,.32,h),M[color],bevel=.003,group='books')
        box('book_spine',(bx,2.972,5.85+h/2),(w+.023,.018,h),M[color],bevel=.006,group='books')
        for dz in (-.20,.18): box('book_spine_rule',(bx,2.960,5.85+h/2+dz),(w*.65,.002,.009),M['gold'],bevel=0,group='books')
    x=1.83
    box('about_frame',(x,3.46,5.58),(1.48,.08,2.23),M['ink'],bevel=.012,interaction='about',group='about')
    box('poster_mat',(x,3.41,5.58),(1.38,.012,2.13),M['paper'],bevel=0,group='about')
    api['add_image_plane']('about_image_upper',(x,3.399,6.0),1.27,1.16,M['photo_sea'],group='about')
    api['add_image_plane']('about_image_lower',(x,3.398,5.01),1.27,.76,M['photo_snow'],group='about')
    for i,(z,color) in enumerate(((6.31,'gold'),(5.16,'blue'),(4.01,'red'))):
        cyl('wall_record_%02d'%i,(3.78,3.45,z),.45,.025,M['vinyl'],vertices=64,rotation=(math.pi/2,0,0),interaction='music',group='music')
        cyl('wall_record_label_%02d'%i,(3.78,3.432,z),.145,.005,M[color],vertices=40,rotation=(math.pi/2,0,0),group='music')
        for r in (.22,.28,.34,.4):
            o=torus('wall_record_groove',(3.78,3.433,z),r,.0018,M['anodized'],group='music'); o.rotation_euler=(math.pi/2,0,0)
    box('wall_switch_plate',(4.88,3.46,3.34),(.27,.045,.36),M['cream'],bevel=.022,interaction='lamp',group='lamp')
    box('wall_switch_rocker',(4.88,3.425,3.34),(.13,.022,.23),M['metal'],bevel=.012,interaction='lamp',group='lamp')
