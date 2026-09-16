"""Small chess table: legal Najdorf position, turned pieces, open study book."""
import json
import math
from pathlib import Path
import bpy


def build(api):
    box, cyl, cone = api['add_box'], api['add_cylinder'], api['add_cone']
    sphere, torus = api['add_uv_sphere'], api['add_torus']
    M = api['M']
    ivory = api['material']('chess_ivory', (.84,.78,.64,1),.34)
    ebony = api['material']('chess_ebony', (.045,.029,.019,1),.31)
    green = api['material']('chess_book_green', (.025,.105,.075,1),.66)
    x,y,z=6.0,-.75,2.18
    box('chess_table_top',(x,y,z),(3.65,2.35,.11),M['oak'],bevel=.035,group='chess')
    for dx in (-1.58,1.58):
        for dy in (-.94,.94):
            box('chess_table_leg',(x+dx,y+dy,1.1),(.10,.10,2.10),M['oak'],bevel=.013,group='chess')
    bx,by=5.12,-.75
    board_z=z+.09
    box('chess_board',(bx,by,board_z),(1.99,1.99,.065),M['oak'],bevel=.018,group='chess')
    cell=.222
    for rank in range(8):
        for file in range(8):
            box('chess_square',(bx+(file-3.5)*cell,by+(rank-3.5)*cell,board_z+.037),(cell,cell,.009),ivory if (file+rank)%2 else ebony,bevel=0,group='chess')

    def text(name,body,loc,size=.052,mat=None):
        curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.size=size
        curve.align_x='CENTER';curve.extrude=.0003
        obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
        obj.location=loc;obj.data.materials.append(mat or M['ink'])
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
        api['tag'](bpy.context.object,None,'chess')

    for i in range(8):
        text('board_file','abcdefgh'[i],(bx+(i-3.5)*cell,by-.95,board_z+.039),.055,ivory)
        text('board_rank',str(i+1),(bx-.95,by+(i-3.5)*cell,board_z+.039),.055,ivory)

    def piece(kind,px,py,mat):
        before=set(bpy.context.scene.objects)
        base=board_z+.049
        cyl('chess_piece_base',(px,py,base+.024),.077,.048,mat,vertices=24,group='chess')
        torus('chess_piece_bead',(px,py,base+.047),.062,.009,mat,group='chess')
        h={'p':.17,'n':.26,'b':.29,'r':.24,'q':.34,'k':.38}[kind]
        cone('chess_piece_stem',(px,py,base+.08),.058,.031,.11,mat,vertices=24,group='chess')
        if kind=='p':
            sphere('chess_pawn_head',(px,py,base+h),(.044,.044,.048),mat,group='chess')
        elif kind=='n':
            cone('chess_knight_neck',(px,py,base+.18),.042,.028,.17,mat,vertices=20,rotation=(.22,0,0),group='chess')
            sphere('chess_knight_head',(px,py-.021,base+.275),(.034,.065,.041),mat,group='chess')
            for dx in (-.023,.023):
                cone('chess_knight_ear',(px+dx,py+.012,base+.316),.013,.003,.038,mat,vertices=10,group='chess')
        elif kind=='r':
            cyl('chess_rook_tower',(px,py,base+.175),.047,.13,mat,vertices=24,group='chess')
            cyl('chess_rook_crown',(px,py,base+.245),.066,.026,mat,vertices=24,group='chess')
            for a in range(4):
                angle=a*math.pi/2
                box('chess_rook_merlon',(px+.047*math.cos(angle),py+.047*math.sin(angle),base+.27),(.028,.028,.027),mat,bevel=.003,group='chess')
        else:
            cone('chess_piece_column',(px,py,base+h*.55),.038,.026,h*.65,mat,vertices=24,group='chess')
            torus('chess_piece_collar',(px,py,base+h-.055),.041,.009,mat,group='chess')
            if kind=='b':
                sphere('chess_bishop_mitre',(px,py,base+h),(.037,.037,.065),mat,group='chess')
            elif kind=='q':
                cone('chess_queen_crown',(px,py,base+h),.027,.055,.06,mat,vertices=24,group='chess')
                for a in range(6):
                    angle=a*math.pi/3
                    sphere('chess_queen_tip',(px+.047*math.cos(angle),py+.047*math.sin(angle),base+h+.034),(.01,.01,.013),mat,group='chess')
            else:
                sphere('chess_king_top',(px,py,base+h-.015),(.036,.036,.035),mat,group='chess')
                box('chess_king_cross_v',(px,py,base+h+.045),(.019,.02,.09),mat,bevel=.003,group='chess')
                box('chess_king_cross_h',(px,py,base+h+.06),(.067,.02,.018),mat,bevel=.003,group='chess')
        parts=[obj for obj in bpy.context.scene.objects if obj not in before]
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:
            obj.select_set(True)
            bpy.context.view_layer.objects.active=obj
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.context.view_layer.objects.active=parts[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        # One independently movable mesh per piece; never merge into static furniture.
        obj.name='chess_piece_'+('w' if mat==ivory else 'b')+kind
        obj['chess_piece']=('w' if mat==ivory else 'b')+kind
        obj['preserve_uv']=True
        bpy.context.scene.cursor.location=(px,py,base)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

    data=json.loads((Path(__file__).resolve().parent.parent/'chess-position.json').read_text())
    count=0
    for row,line in enumerate(data['fen'].split()[0].split('/')):
        file=0
        for char in line:
            if char.isdigit():file+=int(char);continue
            piece(char.lower(),bx+(file-3.5)*cell,by+(7-row-3.5)*cell,ivory if char.isupper() else ebony)
            file+=1;count+=1
    board=bpy.data.objects.get('chess_board')
    board['chess_fen']=data['fen'];board['chess_pgn']=data['pgn'];board['piece_count']=count
    board['preserve_uv']=True

    # Independently typeset study pages, not scans of the copyrighted book.
    book_x,book_y=6.91,-.75
    box('chess_book_cover',(book_x,book_y,z+.087),(1.36,1.68,.04),green,bevel=.016,group='chess')
    for side in (-1,1):
        box('chess_book_page_block',(book_x+side*.34,book_y,z+.13),(.65,1.60,.045),M['paper'],bevel=.012,group='chess')
        for line in range(4):
            box('chess_book_page_edge',(book_x+side*.34,book_y-.801,z+.115+line*.008),(.63,.002,.0015),ivory,bevel=0,group='chess')
    box('chess_book_gutter',(book_x,book_y,z+.156),(.012,1.59,.004),ivory,bevel=0,group='chess')
    # UV-mapped curved leaves get live opening diagrams in Three.js.
    for side,name in ((-1,'left'),(1,'right')):
        vertices=[];faces=[];segments=20
        for j in range(2):
            for i in range(segments+1):
                u=i/segments
                vertices.append((book_x+side*(.012+u*.65),book_y+(.8 if j else -.8),z+.16+.035*math.sin(u*math.pi)))
        for i in range(segments):
            faces.append((i,i+1,segments+2+i,segments+1+i))
        mesh=bpy.data.meshes.new('book_leaf_'+name);mesh.from_pydata(vertices,[],faces);mesh.update()
        obj=bpy.data.objects.new('chess_book_'+name+'_page',mesh);bpy.context.collection.objects.link(obj)
        obj.data.materials.append(M['paper']);obj['preserve_uv']=True;obj['room_group']='chess'
        uv=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            for index in poly.loop_indices:
                v=mesh.loops[index].vertex_index;i=v%(segments+1);j=v//(segments+1)
                uv.data[index].uv=(i/segments if side==1 else 1-i/segments,j)
