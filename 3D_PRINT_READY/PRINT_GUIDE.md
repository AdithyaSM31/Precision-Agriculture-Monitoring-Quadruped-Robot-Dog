# 3D Print Guide — Precision Agriculture Quadruped (SpotMicro + Jetson Orin Nano)

**35 pieces** in the default build. ~700 g PLA+ and ~12 g TPU. Roughly 30–40 h of printing.
Every file here is a verified watertight mesh and fits a 220 × 220 bed.

Filenames carry their quantity: `x2_I_shoulder_mg.stl` means **print two**.

---

## Folders

| Folder | Pieces | What |
|---|---|---|
| `01_BODY/` | 7 | Chassis shell, side plates, ultrasonic mounts |
| `02_LEGS_MG996R/` | 24 | All four legs — brackets cut for **MG996R** |
| `03_JETSON_MOUNT/` | 4 | Modified top cover, Jetson deck, + PPD42 and SGP30 sensor brackets (custom, see `../custom_parts/README.md`) |

`contact_sheet.png` shows every part rendered, so you can identify them at the printer.

---

## Print this first

Print **one `x2_I_shoulder_mg.stl`** (~2 h) and test-fit an actual MG996R before
committing the other 32 pieces. These brackets are cut for exactly this servo
(40.7 x 19.7 x 42.9 mm), so it should drop straight in — you are checking your
printer's tolerances and shrinkage, not the design.

### If you later upgrade to DS3218

You are not locked in. A DS3218 is 40 x 20 x 40.5 mm — only **0.3 mm thicker** than
the MG996R pocket. That is removable with a hand file on the 8 knee/hip brackets;
you would not have to reprint. The `_cls` variants in the original kit are the
cleaner base if you ever do decide to reprint.

---

## Settings

| | PLA+ (everything) | TPU 95A (`foot` only) |
|---|---|---|
| Nozzle / bed | 210–220 °C / 60 °C | 225–235 °C / 55 °C |
| Layer height | 0.2 mm | 0.2 mm |
| Walls | **4** | 3 |
| Infill | 40 % gyroid | 50 % grid |
| Speed | 50–60 mm/s | 20–25 mm/s |

Four walls is not optional on the leg parts — they carry the full body weight in bending.

**Supports:** the two `arm_joint`, both body covers (`F_cover`, `R_cover`,
`non-mega_B_cover_mg`) and `foot` need them. Tree supports work well. Everything in
`03_JETSON_MOUNT/` prints support-free.

**Orientation:** the two parts in `03_JETSON_MOUNT/` are already laid out bed-ready.
The stock SpotMicro files arrive in *assembly* orientation, not print orientation, so
they will import at odd angles. I deliberately left them untouched rather than baking in
a rotation — I tested automatic re-orientation and it was a wash (minimising height made
supports worse, minimising supports stood parts on end). Use your slicer's
**"place on face" / "lay flat"** on a large flat face; that is what the SpotMicro
community does and it is reliable.

---

## Do NOT print these from the original kit

| File | Why |
|---|---|
| `plate.stl` | Arduino Mega electronics deck — replaced by `jetson_deck.stl` |
| `non-mega_T_cover_mg.stl` | replaced by `T_cover_jetson_mg.stl` (adds cable slots + vents) |
| `T_cover_*`, `B_cover_*`, `L_side_plate.stl` | the non-"non-mega" versions have the Arduino Mega port cutout |
| all `*_cls` files | those are for CLS6336HV / DS3218 servos, not MG996R |

---

## Non-printed parts to order alongside

From the designer's README, per the original build:

- 8 × F625zz flange bearings
- 8 × M5×15 · 40 × M4×20 · 8 × M4×15 · 48 × M4 nut · 4 × M3×20 · 28 × M3×10 · 16 × M3 nut
- **Hot glue** — the designer specifies it for bonding servo horns to the printed parts

Plus for the Jetson mount: 4 × M4×20 + M4 washers, 4 × M2.5×8 self-tapping, 2 × velcro straps.


## Sensor brackets

Both bolt to the deck's M3 grid with 4 × M3 × 10 + nuts, and both were checked
for zero interference against the deck and the Jetson envelope.

| Part | Holds | Deck holes used |
|---|---|---|
| `x1_ppd42_bracket.stl` | Shinyei PPD42, **upright** | X 42 / 54 · Z 21 / 93 |
| `x1_sgp30_bracket.stl` | Grove SGP30, raised 22 mm | X 186 / 198 · Z 21 / 93 |

The PPD42 cradle is a 23 mm open slot with a back stop and a zip-tie slot through
both walls — it holds the sensor regardless of its own mounting-hole pattern.
It **must** stand upright: the PPD42 relies on a heater-driven convection current,
and laid flat it reads wrong. Check the datasheet arrow for which edge is down
before fixing it — the cradle accepts it either way up.

The SGP30 platform has a 20.6 × 40.6 mm pocket for the Grove PCB and two strap
slots. The 22 mm stand-off keeps it in clear air rather than in the deck boundary layer.
