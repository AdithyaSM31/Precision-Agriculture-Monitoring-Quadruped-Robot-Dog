"""
SpotMicro -> Jetson Orin Nano external-mount conversion.
Generates:
  1. T_cover_jetson_mg.stl  - original non-mega top cover + cable slots + vents
  2. jetson_deck.stl        - external deck carrying the Orin Nano Dev Kit + sensors

Coordinate frame is INHERITED from the original SpotMicro STLs so every part
lands in the right place if you import them together:
    X = 30..210  (body length, 180 mm)      X=120 is body centre
    Y = vertical, top-cover crown face at Y=124
    Z = 0..114   (body width)               Z=57  is body centre

Measured from non-mega_T_cover_mg.stl:
    crown flat face  : Y=124, X 30..210, Z 17.2..96.8   (roof ~2.25 mm thick)
    existing screws  : 4 x d5.17 at (X,Z) = (35,37) (35,77) (205,37) (205,77)
"""
import numpy as np, trimesh, shapely.geometry as sg
from shapely.ops import unary_union
from trimesh.transformations import rotation_matrix

# ----------------------------------------------------------------- PARAMETERS
SRC = r"C:\Users\adith\Downloads\Final Year Proj New\Spotmicro - robot dog - 3445283 - part 1 of 2\files\non-mega_T_cover_mg.stl"
OUT = r"C:\Users\adith\Downloads\Final Year Proj New\custom_parts"

CROWN_Y   = 124.0            # top face of the cover
BOLTS     = [(35,37),(35,77),(205,37),(205,77)]   # existing cover screw holes

DECK_X    = (30.0, 210.0)    # deck footprint, matches the cover exactly
DECK_Z    = (7.0, 107.0)
DECK_T    = 4.0              # plate thickness
CORNER_R  = 6.0

# Jetson Orin Nano Developer Kit -- carrier PCB is 100 x 79 mm.
# The heatsink+fan is 103 x 90.5 x 34.7 and simply overhangs in free air.
PCB_X, PCB_Z = 100.0, 79.0
PCB_CX, PCB_CZ = 120.0, 57.0

# >>> VERIFY WITH CALIPERS BEFORE PRINTING THE DECK <<<
# Centre-to-centre spacing of the carrier board's 4 x M2.5 mounting holes.
# Defaults below are an ESTIMATE. Measure your board, edit these two numbers,
# and re-run this script -- nothing else needs to change.
HOLE_SPAN_X = 86.0
HOLE_SPAN_Z = 58.0

STANDOFF_H  = 6.0            # lifts the board off the deck for airflow
STANDOFF_R  = 3.5
PILOT_R     = 1.05           # M2.5 self-tapping
PCB_T       = 1.6            # carrier board thickness
BOLT_R      = 2.15           # M4 clearance (use M4x20 + washers)
M3_R        = 1.6            # sensor grid

# ------------------------------------------------------------------- HELPERS
def to_world(mesh):
    """(u,v,w) -> world (X, Y, Z) = (u, w+CROWN_Y, 114-v).  det=+1, no mirror."""
    T = np.array([[1,0,0,0],
                  [0,0,1,CROWN_Y],
                  [0,-1,0,114.0],
                  [0,0,0,1]], float)
    return mesh.apply_transform(T)

def rrect(x0, z0, x1, z1, r=0.0):
    b = sg.box(x0+r, z0+r, x1-r, z1-r)
    return b.buffer(r, join_style=1, quad_segs=16) if r > 0 else b

def slot(cx, cz, lx, lz):
    """Stadium slot: rounded ends on the long axis."""
    if lx >= lz:
        r = lz/2.0
        return sg.LineString([(cx-lx/2+r, cz), (cx+lx/2-r, cz)]).buffer(r, quad_segs=16)
    r = lx/2.0
    return sg.LineString([(cx, cz-lz/2+r), (cx, cz+lz/2-r)]).buffer(r, quad_segs=16)

def box_w(x0, x1, y0, y1, z0, z1):
    m = trimesh.creation.box(extents=[x1-x0, y1-y0, z1-z0])
    m.apply_translation([(x0+x1)/2, (y0+y1)/2, (z0+z1)/2])
    return m

def cyl_y(x, z, r, y0, y1, sections=48):
    m = trimesh.creation.cylinder(radius=r, height=y1-y0, sections=sections)
    m.apply_transform(rotation_matrix(-np.pi/2, [1,0,0]))
    m.apply_translation([x, (y0+y1)/2, z])
    return m

def diff(a, bs):
    return trimesh.boolean.difference([a] + list(bs), engine='manifold')

def union(ms):
    return trimesh.boolean.union(list(ms), engine='manifold')

# =============================================================== 1. TOP COVER
def build_cover():
    cover = trimesh.load(SRC)
    y0, y1 = CROWN_Y - 6.0, CROWN_Y + 2.0     # cut window spans the 2.25mm roof
    cuts = []

    # CSI camera ribbon pass-through, one near each end (front is whichever end
    # you bolt F_cover to -- the unused slot just becomes another vent).
    for cx in (48.0, 192.0):
        cuts.append(slot(cx, 57.0, 4.0, 26.0))

    # Main power / I2C harness slot, centred under the deck's airflow cutout
    cuts.append(slot(120.0, 57.0, 40.0, 12.0))

    # Bay ventilation -- these sit inside the deck cutout so air can actually move
    for cz in (34.0, 42.0, 72.0, 80.0):
        cuts.append(slot(120.0, cz, 60.0, 4.0))

    solids = []
    for poly in cuts:
        m = trimesh.creation.extrude_polygon(poly, height=y1-y0)
        m = to_world(m)                       # (u,v,w) -> (X, w+124, 114-v)
        m.apply_translation([0, y0-CROWN_Y, 0])
        solids.append(m)
    return diff(cover, solids)

# ==================================================================== 2. DECK
def build_deck():
    x0, x1 = DECK_X; z0, z1 = DECK_Z
    outer = rrect(x0, z0, x1, z1, CORNER_R)

    holes = []
    # central airflow + cable cutout, under the Jetson
    holes.append(rrect(84, 30, 156, 84, 6.0))
    # bolts down to the cover's existing 4 screw holes
    holes += [sg.Point(bx, bz).buffer(BOLT_R, quad_segs=32) for bx, bz in BOLTS]
    # velcro / zip-tie strap slots (pattern-independent fallback restraint)
    for sx in (85.0, 155.0):
        for sz in (14.0, 100.0):
            holes.append(slot(sx, sz, 12.0, 4.0))
    # M3 sensor grid on the two end strips (DHT22 / MQ-135 / NEO-6M / PMS5003)
    for gx in (42, 54, 66, 174, 186, 198):
        for gz in (21, 33, 45, 57, 69, 81, 93):
            holes.append(sg.Point(gx, gz).buffer(M3_R, quad_segs=16))

    profile = outer.difference(unary_union(holes))
    plate = trimesh.creation.extrude_polygon(profile, height=DECK_T)
    plate = to_world(plate)

    add = []
    # stiffening side rails (upstands -- cannot foul the cover's curved skirt)
    for za, zb in ((z0, z0+2.5), (z1-2.5, z1)):
        add.append(box_w(x0+CORNER_R, x1-CORNER_R,
                         CROWN_Y+DECK_T-1.0, CROWN_Y+DECK_T+4.0, za, zb))

    # Jetson standoff posts
    yb, yt = CROWN_Y + DECK_T - 1.0, CROWN_Y + DECK_T + STANDOFF_H
    posts, pilots = [], []
    for px in (PCB_CX - HOLE_SPAN_X/2, PCB_CX + HOLE_SPAN_X/2):
        for pz in (PCB_CZ - HOLE_SPAN_Z/2, PCB_CZ + HOLE_SPAN_Z/2):
            posts.append(cyl_y(px, pz, STANDOFF_R, yb, yt))
            pilots.append(cyl_y(px, pz, PILOT_R, CROWN_Y - 1, yt + 1))
    add += posts

    # L-shaped corner guides -- locate the board even if the hole pattern is off.
    # Tall enough (Y 128..137) to capture the PCB sitting on 6mm standoffs.
    gx0, gx1 = PCB_CX - PCB_X/2 - 0.5, PCB_CX + PCB_X/2 + 0.5
    gz0, gz1 = PCB_CZ - PCB_Z/2 - 0.5, PCB_CZ + PCB_Z/2 + 0.5
    gt, gl = 2.5, 14.0
    # top of guides is flush with the PCB top face, so the wider heatsink
    # (103 x 90.5) that overhangs the 100 x 79 carrier can never foul them
    gy0 = CROWN_Y + DECK_T - 1.0
    gy1 = CROWN_Y + DECK_T + STANDOFF_H + PCB_T - 0.1
    for cx, sgx in ((gx0, -1), (gx1, +1)):
        for cz, sgz in ((gz0, -1), (gz1, +1)):
            ox, oz = cx + sgx*gt, cz + sgz*gt        # outer corner of the L
            ax = sorted((ox, cx));      az = sorted((oz, oz - sgz*gl))
            bx = sorted((ox, ox - sgx*gl)); bz = sorted((oz, cz))
            add.append(box_w(ax[0], ax[1], gy0, gy1, az[0], az[1]))   # arm along Z
            add.append(box_w(bx[0], bx[1], gy0, gy1, bz[0], bz[1]))   # arm along X

    deck = union([plate] + add)
    return diff(deck, pilots)

# ==================================================================== RUN
def to_print(mesh, flip):
    """Lay the part on the bed. flip=False: +Y becomes +Z (deck, features up).
       flip=True : +Y becomes -Z (cover, crown face-down on the bed)."""
    m = mesh.copy()
    m.apply_transform(rotation_matrix((-1 if flip else 1)*np.pi/2, [1,0,0]))
    m.apply_translation([0, 0, -m.bounds[0][2]])
    m.apply_translation([-m.bounds[0][0], -m.bounds[0][1], 0])
    return m

if __name__ == "__main__":
    import os
    for name, fn, flip in (("T_cover_jetson_mg", build_cover, True),
                           ("jetson_deck",       build_deck,  False)):
        m = fn()
        m.export(os.path.join(OUT, name + "_ASSEMBLY.stl"))     # original body frame
        pm = to_print(m, flip)
        pm.export(os.path.join(OUT, name + ".stl"))             # bed-ready
        print(f"{name:20s} watertight={m.is_watertight!s:5s} vol={m.volume/1000:6.1f} cm3"
              f"  print footprint {pm.extents[0]:6.1f} x {pm.extents[1]:6.1f}"
              f" x {pm.extents[2]:5.1f} mm")
