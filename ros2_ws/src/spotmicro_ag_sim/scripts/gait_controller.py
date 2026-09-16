#!/usr/bin/env python3
"""
Gait + inverse kinematics node for the SpotMicro agriculture quadruped.

The IK below is the same solver verified in the browser simulator: it picks the
knee-back elbow branch, which is the one that actually puts the foot on target
(the other branch folds the leg back over itself and places the foot above the hip).

Publishes 12 joint positions to /leg_position_controller/commands.
"""
import math
import rclpy
from rclpy.node import Node
from std_msgs.msg import Float64MultiArray
from sensor_msgs.msg import JointState

# MG996R modelled as a saturating position servo on an effort interface:
#   tau = clamp(KP*(target - actual) - KD*velocity, +/- TAU_MAX)
# TAU_MAX is the datasheet 11 kg.cm at 6 V; drop it to ~0.8 to represent clones.
# Abduction is the stiffest: the foot sits 60 mm outboard of its axis, so droop
# there increases the lateral moment, which increases the droop.
TAU_MAX = 1.08
GAINS = {'abd': (60.0, 2.0), 'hip': (30.0, 1.2), 'knee': (30.0, 1.2)}

L0, L1, L2 = 0.060, 0.111, 0.125        # abduction offset, femur, tibia  (m)
HL, HW     = 0.070, 0.039               # half hip spacing: length, width  (m)

# (prefix, x sign, y sign) — front = +x, left = +y
LEGS = [('fl', +1, +1), ('fr', +1, -1), ('rl', -1, +1), ('rr', -1, -1)]

GAITS = {                                # duty factor, phase offsets, cycles/s
    'crawl': dict(duty=0.80, off=[0.00, 0.50, 0.25, 0.75], hz=0.55),
    'trot':  dict(duty=0.52, off=[0.00, 0.50, 0.50, 0.00], hz=1.30),
    'stand': dict(duty=1.00, off=[0.0, 0.0, 0.0, 0.0],     hz=0.0),
}


def solve_ik(tx, ty, tz, ys):
    """Foot target in the leg-root frame (x fwd, y left, z up). Returns
    (abduction, hip pitch, knee) in radians, or None if unreachable."""
    y = ty * ys                                  # mirror so both sides solve alike
    R = math.hypot(tz, y)
    if R < L0 + 1e-4:
        return None
    phi = math.atan2(tz, y)
    a1 = -math.acos(max(-1.0, min(1.0, L0 / R))) - phi
    zp = tz * math.cos(a1) + y * math.sin(a1)    # vertical in the un-abducted plane
    G = math.hypot(tx, zp)
    Gc = max(abs(L1 - L2) + 1e-3, min(L1 + L2 - 1e-3, G))
    gam = math.acos(max(-1.0, min(1.0, (L1*L1 + L2*L2 - Gc*Gc) / (2*L1*L2))))
    beta = math.acos(max(-1.0, min(1.0, (L1*L1 + Gc*Gc - L2*L2) / (2*L1*Gc))))
    alpha = math.atan2(tx, -zp)          # hip->foot direction, from straight down
    # Femur points back (knee trails), so its direction angle is alpha-beta and the
    # URDF joint, which rotates about +Y, takes the negative of that.
    hip = beta - alpha
    knee = -(math.pi - gam)              # tibia swings forward off the femur
    return a1 * ys, hip, knee


def foot_offset(p, g, stride, lift):
    if g['hz'] == 0.0:
        return 0.0, 0.0
    if p < g['duty']:                            # stance: sweep back
        u = p / g['duty']
        return stride / 2 - stride * u, 0.0
    u = (p - g['duty']) / (1 - g['duty'])        # swing: arc forward
    return -stride / 2 + stride * u, lift * math.sin(math.pi * u)


class GaitController(Node):
    def __init__(self):
        super().__init__('gait_controller')
        self.declare_parameter('gait', 'crawl')
        self.declare_parameter('stride', 0.060)
        self.declare_parameter('lift', 0.035)
        self.declare_parameter('height', 0.150)
        self.declare_parameter('speed', 1.0)
        self.declare_parameter('settle', 2.5)     # hold a stand before walking

        self.pub = self.create_publisher(
            Float64MultiArray, '/leg_effort_controller/commands', 10)
        self.create_subscription(JointState, '/joint_states', self.on_state, 10)
        self.names = [f'{p}_{j}_joint' for p, _, _ in LEGS
                      for j in ('abd', 'hip', 'knee')]
        self.pos = {n: 0.0 for n in self.names}
        self.vel = {n: 0.0 for n in self.names}
        self.have_state = False
        self.start_pos = None      # measured pose at first command
        self.phase = 0.0
        self.t = 0.0
        self.dt = 1.0 / 200.0
        self.create_timer(self.dt, self.tick)
        self.get_logger().info('gait_controller up — settling before walking')

    def on_state(self, msg):
        for i, n in enumerate(msg.name):
            if n in self.pos:
                self.pos[n] = msg.position[i]
                if i < len(msg.velocity):
                    self.vel[n] = msg.velocity[i]
        self.have_state = True

    def p(self, n):
        return self.get_parameter(n).value

    def tick(self):
        # Wait for real joint feedback: the first command must start from where
        # the joints actually are. A position interface moves joints kinematically,
        # so any step change teleports the links and the contact impulse launches
        # the robot across the world.
        if not self.have_state:
            return
        if self.start_pos is None:
            self.start_pos = [self.pos[n] for n in self.names]
            self.get_logger().info('captured spawn pose, easing into stance')

        self.t += self.dt
        ramp = self.p('settle')
        easing = self.t < ramp

        g = GAITS['stand'] if easing else GAITS.get(self.p('gait'), GAITS['crawl'])
        lift = self.p('lift')
        # ease the stride in as well, so the first step does not jump either
        after = self.t - ramp
        stride = self.p('stride') * min(1.0, max(0.0, after / 2.0))

        self.phase = (self.phase + self.dt * g['hz'] * self.p('speed')) % 1.0

        target = []
        for i, (pfx, xs, ys) in enumerate(LEGS):
            ph = (self.phase + g['off'][i]) % 1.0
            dx, dz = foot_offset(ph, g, stride, lift)
            sol = solve_ik(dx, ys * L0, -self.p('height') + dz, ys)
            if sol is None:
                sol = (0.0, 0.9563, -1.7683)
            target.extend(sol)

        if easing:
            # smoothstep: zero velocity at both ends of the move
            u = min(1.0, self.t / max(1e-3, ramp))
            u = u * u * (3.0 - 2.0 * u)
            cmd = [s + (t - s) * u for s, t in zip(self.start_pos, target)]
        else:
            cmd = target

        # servo model: PD toward the eased target, clamped at the MG996R limit
        tau = []
        for n, want in zip(self.names, cmd):
            kp, kd = GAINS[n.split('_')[1]]
            t = kp * (want - self.pos[n]) - kd * self.vel[n]
            tau.append(max(-TAU_MAX, min(TAU_MAX, t)))

        msg = Float64MultiArray()
        msg.data = [float(v) for v in tau]
        self.pub.publish(msg)


def main():
    rclpy.init()
    node = GaitController()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
