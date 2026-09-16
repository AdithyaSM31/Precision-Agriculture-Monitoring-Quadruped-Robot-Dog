"""Regenerate the URDF and controller config for the Gazebo simulation."""
import os

L0, L1, L2 = 0.060, 0.111, 0.125
HL, HW = 0.070, 0.039
BL, BW, BH = 0.180, 0.114, 0.074
VEL, EFF = 8.0, 1.08

LINKS = {'base': (1.009, BL, BW, BH), 'abd': (0.030, 0.040, 0.040, 0.040),
         'femur': (0.1335, 0.026, 0.015, L1), 'tibia': (0.0236, 0.017, 0.011, L2)}


def inertial(k, z=0.0):
    m, x, y, zz = LINKS[k]
    ix, iy, iz = m*(y*y+zz*zz)/12, m*(x*x+zz*zz)/12, m*(x*x+y*y)/12
    return ('    <inertial><origin xyz="0 0 %.6f"/><mass value="%.5f"/>\n'
            '      <inertia ixx="%.8f" ixy="0" ixz="0" iyy="%.8f" iyz="0" izz="%.8f"/>\n'
            '    </inertial>\n') % (z, m, ix, iy, iz)


LEGS = [('fl', +1, +1), ('fr', +1, -1), ('rl', -1, +1), ('rr', -1, -1)]
JOINTS = []

LEG_TMPL = '''
  <!-- ===== {P} leg ===== -->
  <joint name="{p}_abd_joint" type="revolute">
    <parent link="base_link"/><child link="{p}_abd_link"/>
    <origin xyz="{ox:.4f} {oy:.4f} 0"/><axis xyz="1 0 0"/>
    <limit lower="-0.70" upper="0.70" effort="{eff}" velocity="{vel}"/>
    <dynamics damping="0.10" friction="0.02"/>
  </joint>
  <link name="{p}_abd_link">
{in_abd}    <visual><origin xyz="0 {sv1:.4f} 0"/>
      <geometry><box size="0.041 0.041 0.020"/></geometry><material name="servo"/></visual>
    <visual><origin xyz="0 {sv2:.4f} 0"/>
      <geometry><box size="0.030 0.030 0.034"/></geometry><material name="shell"/></visual>
    <collision><origin xyz="0 {sv3:.4f} 0"/>
      <geometry><box size="0.040 0.050 0.034"/></geometry></collision>
  </link>

  <joint name="{p}_hip_joint" type="revolute">
    <parent link="{p}_abd_link"/><child link="{p}_femur_link"/>
    <origin xyz="0 {hy:.4f} 0"/><axis xyz="0 1 0"/>
    <limit lower="-1.60" upper="1.60" effort="{eff}" velocity="{vel}"/>
    <dynamics damping="0.10" friction="0.02"/>
  </joint>
  <link name="{p}_femur_link">
{in_fem}    <visual><origin xyz="0 {sk:.4f} 0"/>
      <geometry><box size="0.040 0.020 0.040"/></geometry><material name="servo"/></visual>
    <visual><origin xyz="0 0 {fh:.4f}"/>
      <geometry><box size="0.028 0.014 {l1:.4f}"/></geometry><material name="limb"/></visual>
    <visual><origin xyz="0 {sk:.4f} {nl1:.4f}"/>
      <geometry><box size="0.040 0.020 0.040"/></geometry><material name="servo"/></visual>
    <collision><origin xyz="0 0 {fh:.4f}"/>
      <geometry><box size="0.026 0.014 {l1c:.4f}"/></geometry></collision>
  </link>

  <joint name="{p}_knee_joint" type="revolute">
    <parent link="{p}_femur_link"/><child link="{p}_tibia_link"/>
    <origin xyz="0 0 {nl1:.4f}"/><axis xyz="0 1 0"/>
    <limit lower="-2.60" upper="0.0" effort="{eff}" velocity="{vel}"/>
    <dynamics damping="0.10" friction="0.02"/>
  </joint>
  <link name="{p}_tibia_link">
{in_tib}    <visual><origin xyz="0 0 {th:.4f}"/>
      <geometry><box size="0.018 0.011 {l2v:.4f}"/></geometry><material name="shank"/></visual>
    <collision><origin xyz="0 0 {th:.4f}"/>
      <geometry><box size="0.018 0.011 {l2c:.4f}"/></geometry></collision>
  </link>

  <joint name="{p}_foot_joint" type="fixed">
    <parent link="{p}_tibia_link"/><child link="{p}_foot_link"/>
    <origin xyz="0 0 {fo:.4f}"/>
  </joint>
  <link name="{p}_foot_link">
    <inertial><mass value="0.004"/>
      <inertia ixx="2e-7" ixy="0" ixz="0" iyy="2e-7" iyz="0" izz="2e-7"/></inertial>
    <visual><geometry><sphere radius="0.013"/></geometry><material name="foot"/></visual>
    <collision><geometry><sphere radius="0.013"/></geometry></collision>
  </link>
  <gazebo reference="{p}_foot_link">
    <mu1>1.1</mu1><mu2>1.1</mu2><kp>2e5</kp><kd>15.0</kd>
    <minDepth>0.001</minDepth><maxVel>0.2</maxVel><material>Gazebo/Orange</material>
  </gazebo>
  <gazebo reference="{p}_femur_link"><material>Gazebo/Grey</material></gazebo>
  <gazebo reference="{p}_tibia_link"><material>Gazebo/DarkGrey</material></gazebo>
  <gazebo reference="{p}_abd_link"><material>Gazebo/DarkGrey</material></gazebo>
'''


def leg_xml(p, xs, ys):
    JOINTS.extend(['%s_abd_joint' % p, '%s_hip_joint' % p, '%s_knee_joint' % p])
    return LEG_TMPL.format(
        P=p.upper(), p=p, ox=xs*HL, oy=ys*HW, eff=EFF, vel=VEL,
        in_abd=inertial('abd'), in_fem=inertial('femur', -L1/2),
        in_tib=inertial('tibia', -L2/2),
        sv1=ys*0.020, sv2=ys*0.045, sv3=ys*0.030,
        hy=ys*L0, sk=ys*-0.012, fh=-L1/2, l1=L1, l1c=L1-0.020, nl1=-L1,
        th=-(L2-0.013)/2, l2v=L2-0.013, l2c=L2-0.030, fo=-(L2-0.013))


HEAD = '''<?xml version="1.0"?>
<!-- SpotMicro precision-agriculture quadruped.

     Link lengths measured from the printed STLs; masses derived from print
     volumes at 40% infill plus real component weights (total 1.7574 kg).

     Joints use a POSITION command interface. An RC servo is a high-gain internal
     position loop, so commanding the joint angle is a faithful model of how an
     MG996R behaves, and it keeps the contact solver stable. The body and feet
     retain full gravity and contact dynamics. Effort limits are still declared
     and Gazebo reports actual joint effort on the state interface, so torque
     stays observable here; it is simply not saturated. Torque saturation is
     analysed separately in the quasi-static model. -->
<robot name="spotmicro_ag" xmlns:xacro="http://www.ros.org/wiki/xacro">

  <material name="shell"><color rgba="0.86 0.88 0.90 1"/></material>
  <material name="servo"><color rgba="0.15 0.17 0.20 1"/></material>
  <material name="limb"><color rgba="0.72 0.75 0.78 1"/></material>
  <material name="shank"><color rgba="0.22 0.25 0.29 1"/></material>
  <material name="foot"><color rgba="0.94 0.63 0.29 1"/></material>
  <material name="deck"><color rgba="0.22 0.47 0.76 1"/></material>
  <material name="sensor"><color rgba="0.30 0.62 0.35 1"/></material>

  <link name="base_link">
{in_base}    <visual><geometry><box size="{bl} {bw} {bh}"/></geometry><material name="shell"/></visual>
    <collision><geometry><box size="{bl} {bw} {bh}"/></geometry></collision>
  </link>
  <gazebo reference="base_link"><material>Gazebo/White</material></gazebo>

  <!-- external Jetson deck, Orin Nano, and the two sensor brackets -->
  <joint name="deck_joint" type="fixed"><parent link="base_link"/><child link="deck_link"/>
    <origin xyz="0 0 {dz:.4f}"/></joint>
  <link name="deck_link">
    <inertial><mass value="0.001"/><inertia ixx="1e-7" ixy="0" ixz="0" iyy="1e-7" iyz="0" izz="1e-7"/></inertial>
    <visual><geometry><box size="0.180 0.100 0.005"/></geometry><material name="deck"/></visual>
  </link>
  <gazebo reference="deck_link"><material>Gazebo/SkyBlue</material></gazebo>

  <joint name="jetson_joint" type="fixed"><parent link="deck_link"/><child link="jetson_link"/>
    <origin xyz="0 0 0.0195"/></joint>
  <link name="jetson_link">
    <inertial><mass value="0.001"/><inertia ixx="1e-7" ixy="0" ixz="0" iyy="1e-7" iyz="0" izz="1e-7"/></inertial>
    <visual><geometry><box size="0.103 0.090 0.034"/></geometry><material name="servo"/></visual>
  </link>
  <gazebo reference="jetson_link"><material>Gazebo/DarkGrey</material></gazebo>

  <joint name="ppd42_joint" type="fixed"><parent link="deck_link"/><child link="ppd42_link"/>
    <origin xyz="-0.072 0 0.0250"/></joint>
  <link name="ppd42_link">
    <inertial><mass value="0.001"/><inertia ixx="1e-7" ixy="0" ixz="0" iyy="1e-7" iyz="0" izz="1e-7"/></inertial>
    <visual><geometry><box size="0.022 0.059 0.045"/></geometry><material name="sensor"/></visual>
  </link>
  <gazebo reference="ppd42_link"><material>Gazebo/Green</material></gazebo>

  <joint name="sgp30_joint" type="fixed"><parent link="deck_link"/><child link="sgp30_link"/>
    <origin xyz="0.076 0 0.0235"/></joint>
  <link name="sgp30_link">
    <inertial><mass value="0.001"/><inertia ixx="1e-7" ixy="0" ixz="0" iyy="1e-7" iyz="0" izz="1e-7"/></inertial>
    <visual><geometry><box size="0.020 0.040 0.008"/></geometry><material name="sensor"/></visual>
  </link>
  <gazebo reference="sgp30_link"><material>Gazebo/Green</material></gazebo>
'''

TAIL = '''
  <gazebo><self_collide>false</self_collide></gazebo>

  <!-- IMU at the MPU6050 location, publishing on /imu/data.
       Attached to base_link rather than its own link: a link carrying only
       inertia and no geometry is lumped into its parent during URDF to SDF
       conversion, and the sensor disappears with it. -->
  <gazebo reference="base_link">
    <sensor name="imu_sensor" type="imu">
      <always_on>true</always_on><update_rate>100</update_rate>
      <plugin filename="libgazebo_ros_imu_sensor.so" name="imu_plugin">
        <ros><remapping>~/out:=/imu/data</remapping></ros>
        <frame_name>base_link</frame_name>
      </plugin>
    </sensor>
  </gazebo>

  <ros2_control name="GazeboSystem" type="system">
    <hardware><plugin>gazebo_ros2_control/GazeboSystem</plugin></hardware>
{ctl}
  </ros2_control>

  <gazebo>
    <plugin filename="libgazebo_ros2_control.so" name="gazebo_ros2_control">
      <parameters>$(find spotmicro_ag_sim)/config/controllers.yaml</parameters>
    </plugin>
  </gazebo>
</robot>
'''

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    body = ''.join(leg_xml(*l) for l in LEGS)
    # Effort interface. A position interface drives joints with SetPosition,
    # which teleports links every cycle: fine for a fixed-base arm, but on a
    # floating base with feet in contact it injects energy and launches the
    # robot. No initial_value either, for the same reason: the robot spawns
    # straight-legged and the gait node eases it into stance.
    ctl = '\n'.join(
        '    <joint name="%s">\n'
        '      <command_interface name="effort"/>\n'
        '      <state_interface name="position"/>\n'
        '      <state_interface name="velocity"/>\n'
        '      <state_interface name="effort"/>\n'
        '    </joint>' % j for j in JOINTS)

    import re as _re

    def strip_for_plugin(x):
        x = _re.sub(r'<\?xml[^>]*\?>\s*', '', x)     # drop the XML declaration
        x = _re.sub(r'<!--.*?-->', '', x, flags=_re.S)  # drop all comments
        x = _re.sub(r'\n\s*\n+', '\n', x)
        return x.lstrip()

    urdf = (HEAD.format(in_base=inertial('base', 0.008), bl=BL, bw=BW, bh=BH,
                        dz=BH/2 + 0.0025)
            + body + TAIL.format(ctl=ctl))
    clean = strip_for_plugin(urdf)
    with open(os.path.join(here, 'urdf', 'spotmicro.urdf.xacro'), 'wb') as f:
        f.write(clean.encode())

    # Tethered variant: base pinned to the world, so the legs run the gait with
    # the feet clear of the ground. This is the same bring-up step used on real
    # hardware -- verify the walk cycle on a stand before it carries its own
    # weight -- and it is what the free-standing model cannot yet do.
    # A gantry rail, not a rigid pin: roll, pitch, yaw, Y and Z are held, but the
    # base slides freely along X. The stance legs then push against the ground and
    # actually propel the body forward, so the gait reads as walking instead of
    # the stance feet dragging on the spot. Real quadruped labs use a physical
    # boom for the same reason. The joint is unactuated -- nothing drives it but
    # the legs themselves.
    tether = ('  <link name="world"/>\n'
              '  <joint name="world_rail" type="prismatic">\n'
              '    <parent link="world"/><child link="base_link"/>\n'
              '    <axis xyz="1 0 0"/>\n'
              '    <limit lower="-40" upper="40" effort="1000" velocity="5"/>\n'
              # Damping sets the terminal speed along the rail. Undamped, the legs
              # paddle the body away at ~0.5 m/s -- an order of magnitude past the
              # ~4 cm/s the crawl gait should actually produce.
              # Damping 2.2 N.s/m, friction essentially zero. Coulomb friction is
              # the parameter that matters most here: an earlier friction=2.0
              # exceeded the legs' net thrust outright and stopped the rail dead,
              # which read as "damping does not work" when friction was the cause.
              # Keep friction far below the thrust or the rail never breaks loose.
              # Measured behaviour: the legs deliver a transient push, not sustained
              # thrust. At damping 2.2 that transient carried the body ~9 m before
              # it plateaued and stopped. Damping 10 keeps the excursion to ~2 m so
              # the robot stays in frame; it does not create sustained locomotion,
              # which the gait controller is not yet producing.
              '    <dynamics damping="10.0" friction="0.01"/>\n'
              '  </joint>\n')
    idx = clean.index('  <link name="base_link">')
    tethered = clean[:idx] + tether + clean[idx:]
    with open(os.path.join(here, 'urdf', 'spotmicro_tethered.urdf.xacro'), 'wb') as f:
        f.write(tethered.encode())

    jl = '\n'.join('      - %s' % j for j in JOINTS)
    yaml = ('controller_manager:\n'
            '  ros__parameters:\n'
            '    update_rate: 500\n'
            '    use_sim_time: true\n\n'
            '    joint_state_broadcaster:\n'
            '      type: joint_state_broadcaster/JointStateBroadcaster\n\n'
            '    leg_effort_controller:\n'
            '      type: effort_controllers/JointGroupEffortController\n\n'
            'leg_effort_controller:\n'
            '  ros__parameters:\n'
            '    joints:\n' + jl + '\n')
    with open(os.path.join(here, 'config', 'controllers.yaml'), 'wb') as f:
        f.write(yaml.encode())
    with open(os.path.join(here, 'config', 'joint_order.txt'), 'wb') as f:
        f.write('\n'.join(JOINTS).encode())

    tot = LINKS['base'][0] + 4*(LINKS['abd'][0] + LINKS['femur'][0] + LINKS['tibia'][0])
    print('urdf: effort interface, %d joints, IMU, total mass %.4f kg' % (len(JOINTS), tot))
    print('urdf: spotmicro_tethered.urdf.xacro also written (base pinned)')
    print('controllers.yaml: effort group controller @ 500 Hz')
