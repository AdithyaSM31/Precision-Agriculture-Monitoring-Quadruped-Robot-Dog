"""
Sensor brackets that bolt onto the jetson_deck M3 grid.

Deck reference (from make_jetson_parts.py):
    plate top face  Y = 128
    M3 grid         X in {42,54,66} and {174,186,198}   Z in {21,33,45,57,69,81,93}
    Jetson envelope X 68.5..171.5, Y 134..168  -> both brackets must clear this in X

  1. ppd42_bracket.stl  - holds the Shinyei PPD42 (59 x 45 x 22) UPRIGHT, which its
     heater-driven convection airflow requires. Open cradle, so it fits regardless of
     the sensor's own mounting-hole pattern.
  2. sgp30_bracket.stl  - raises the Grove SGP30 (20 x 40 PCB) 22 mm into clear air.
"""
import numpy as np, trimesh, os
from trimesh.transformations import rotation_matrix

OUT = os.path.dirname(os.path.abspath(__file__))
DECK_Y = 128.0          # deck top face
M3     = 1.7            # clearance radius for M3

def box(x0,x1,y0,y1,z0,z1):
    m=trimesh.creation.box(extents=[x1-x0,y1-y0,z1-z0])
    m.apply_translation([(x0+x1)/2,(y0+y1)/2,(z0+z1)/2]); return m
def cyl_y(x,z,r,y0,y1,n=40):
    m=trimesh.creation.cylinder(radius=r,height=y1-y0,sections=n)
    m.apply_transform(rotation_matrix(-np.pi/2,[1,0,0]))
    m.apply_translation([x,(y0+y1)/2,z]); return m
def union(ms):  return trimesh.boolean.union(list(ms),engine='manifold')
def diff(a,bs): return trimesh.boolean.difference([a]+list(bs),engine='manifold')

# ---------------------------------------------------------------- PPD42
def ppd42():
    Y0,Y1 = DECK_Y, DECK_Y+4                 # base plate
    WT    = DECK_Y+32                        # cradle wall top
    add=[ box(34,66, Y0,Y1, 12,102) ]        # base: stops short of the deck's corner guides at X=67
    add.append(box(36,39, Y0,WT, 28,92))     # left cradle wall
    add.append(box(62,65, Y0,WT, 28,92))     # right cradle wall   (23 mm slot for a 22 mm sensor)
    add.append(box(36,65, Y0,WT, 28,31))     # back stop
    body=union(add)
    cuts=[cyl_y(x,z,M3,Y0-1,Y1+1) for x in (42,54) for z in (21,93)]
    cuts.append(box(33,67, DECK_Y+20,DECK_Y+23, 55,65))   # zip-tie slot through both walls
    return diff(body,cuts)

# ---------------------------------------------------------------- SGP30
def sgp30():
    Y0,Y1 = DECK_Y, DECK_Y+4
    PT0,PT1 = DECK_Y+22, DECK_Y+25           # platform
    add=[ box(174,208, Y0,Y1, 12,102) ]      # base, starts clear of Jetson at X=171.5
    for px in (180,202):
        for pz in (40,76):
            add.append(box(px-4,px+4, Y0,PT0, pz-4,pz+4))    # posts
    add.append(box(176,206, PT0,PT1, 30,86))                 # platform
    body=union(add)
    cuts=[cyl_y(x,z,M3,Y0-1,Y1+1) for x in (186,198) for z in (21,93)]
    cuts.append(box(180.7,201.3, PT1-1.5,PT1+1, 37.7,78.3))  # 20.6 x 40.6 board pocket
    for sz in (32,81):
        cuts.append(box(182,198, PT0-1,PT1+1, sz,sz+3))      # strap slots
    return diff(body,cuts)

def to_print(m):
    p=m.copy(); p.apply_translation([0,-p.bounds[0][1],0])   # base down to Y=0
    p.apply_transform(rotation_matrix(np.pi/2,[1,0,0]))      # +Y -> +Z for the bed
    p.apply_translation(-p.bounds[0]); return p

if __name__=="__main__":
    for name,fn in (("ppd42_bracket",ppd42),("sgp30_bracket",sgp30)):
        m=fn()
        m.export(os.path.join(OUT,name+"_ASSEMBLY.stl"))
        pm=to_print(m); pm.export(os.path.join(OUT,name+".stl"))
        print(f"{name:16s} watertight={m.is_watertight!s:5s} vol={m.volume/1000:5.1f} cm3"
              f"  bed {pm.extents[0]:5.1f} x {pm.extents[1]:5.1f} x {pm.extents[2]:5.1f} mm")
