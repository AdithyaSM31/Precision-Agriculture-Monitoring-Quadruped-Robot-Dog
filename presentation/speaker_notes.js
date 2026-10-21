// Detailed speaker notes for the final review deck, keyed by slide title.
// Each note: a timing cue, what to say, and likely panel questions with short answers.
module.exports = {
  __title: `[30 s]
Good morning. We are Adithya, Siddhesh and Rachit, and our guide is Dr. Lakshmanan K.

Our project is a low-cost quadruped robot for precision agriculture. It is 3D-printed, it carries wireless sensors for crop-level air quality, a camera for leaf-disease detection, and its walking was designed and validated in a physics simulator before we powered the real servos.

In one line: the sensing payload works end to end, the gait works in simulation with real servo limits, and the real robot now stands and moves its legs.`,

  "How This Review Is Organised": `[30 s]
We have organised the talk around the six criteria of the panel rubric, so you can find the evidence for each one.

Section 1 is the domain and the problem. Section 2 is our methodology and design: architecture, data flow and the algorithms. Section 3 shows what was completed and how it fits together, and ends with the live demo. Section 4 is testing and results, from the hardware and from the simulation. Section 5 covers what is new, cost, ethics and practical use, along with limitations and future work. Section 6 concludes.

The slide numbers on the right show where each section is.`,

  "01|Domain and Problem": `[5 s]
Let us start with the problem and why it matters.`,

  "Crop Disease Is Costly, and Often Seen Too Late": `[50 s]
The FAO estimates that 20 to 40 percent of global crop production is lost to pests and diseases every year. A field study by Savary and colleagues, covering five staple crops in 67 countries, put the losses at 10 to 28 percent for wheat, 25 to 41 percent for rice and 20 to 41 percent for maize.

Much of this damage is preventable if disease is caught early, and early detection needs close, frequent observation at crop level. The platforms used today each fall short in a different way:
- Drones fly over the canopy. They have short flight times and cannot see leaf undersides or sample the air between rows.
- Wheeled rovers lose traction in mud, soft soil and narrow furrows.
- Fixed IoT sensor nodes measure only the spot where they stand.
- Legged research robots like ANYmal can handle the terrain, but they cost far more than a small farm can afford.

If asked:
- "Why does air quality matter for crops?" Stressed and diseased plants change the volatile organic compounds they emit, so a rise in VOCs near a plant can be an early warning sign before symptoms are visible.`,

  "Which Platform Can Monitor Between Crop Rows?": `[40 s]
This table compares the platforms on four needs: sensing close to the leaves, moving on soft soil and in furrows, covering the whole field, and being affordable for a small farm.

Each existing option fails at least one. Drones cannot sense at leaf level. Rovers cannot handle furrows. Fixed nodes cannot cover the field. Research quadrupeds tick every box except cost.

A legged robot walks where a farmer walks: it places each foot, so it can step between plants and over furrows. The question our project tackles is whether a legged monitoring robot can be built cheaply, with printed parts and hobby servos, and still work.

If asked:
- "Is this table measured?" No. It is a qualitative summary drawn from the literature on the next slide.`,

  "What 18 Papers Tell Us": `[60 s]
We surveyed 18 papers in four groups. The full table is in the backup slides at the end.

- Legged locomotion, papers 1 to 6: MIT Cheetah 3, Mini Cheetah, ANYmal and Stanford Doggo show what legged robots can do, using custom actuators and controllers such as model-predictive control and learned policies. None of them carries an agricultural payload, and most are very expensive.
- Field robots and drones, papers 7 to 10: wheeled rovers fail in mud and soft soil, and drones cannot see under the canopy.
- Leaf-disease deep learning, papers 11 to 15: CNNs reach 97 to 99 percent accuracy on the PlantVillage dataset, and MobileNetV2 is efficient enough for low-power devices. But the images are lab photos on plain backgrounds, and these models are closed-set: they will label anything they see as one of their diseases.
- IoT sensing, papers 16 to 18: these use stationary sensor nodes, which leave coverage gaps.

If asked:
- "Which paper is closest to your work?" Saleem et al. conclude that field-ready disease detection needs ground robots that bring the camera close to the leaves, which is what our robot does.`,

  "Research Gaps and How This Project Answers Them": `[50 s]
From the survey we identified four gaps. Each has a direct answer in our build.

1. Low-cost legged robots have not carried a crop-sensing payload, and nobody has quantified whether hobby servos are strong enough. We built a printed 12-servo quadruped with two sensing nodes, and a physics model that uses the real MG996R torque limit.
2. Crop sensing relies on fixed nodes. We put a wireless sensor node on the robot that reports every five seconds to a logging dashboard.
3. Disease classifiers are closed-set and will report a disease for a photo of a wall. We added a vegetation gate that checks there is a leaf before the classifier is allowed to answer.
4. Hobby quadruped designs give no guidance on centre of mass or the speed servos allow. We measured both: the centre of mass sits 12 millimetres behind the body centre, and the trot is limited to about 0.18 metres per second.`,

  "Objectives and Scope": `[40 s]
We had four objectives:
- Mobility: a low-cost printed quadruped whose gait is validated against real servo limits, then tested on the robot.
- Sensing: gas, dust, temperature and range on the chassis.
- Plant-health AI: leaf-disease classification that first checks a leaf is in view.
- A live dashboard: logging, live charts, and leaf images tagged with the air readings at the moment of capture.

In scope: the printed platform, both sensing nodes, the dashboard and classifier, the locomotion design and simulation, and the first actuation trials on the robot.

Out of scope: trials on a working farm, calibrating the sensors against reference instruments, training our own classifier, and GPS mapping.`,

  "02|Methodology and Design": `[5 s]
Now the methodology and technical design.`,

  "Methodology: Analyse, Revise, Build, Validate": `[50 s]
We worked in six steps.

1. Analyse. We analysed the Review III plan for torque, power and heat, and found problems.
2. Revise. We moved inference off the robot to a laptop, and split sensing across two inexpensive ESP32 boards.
3. Build sensing. We wrote the sensor-node and camera firmware and wired the sensors through voltage dividers.
4. Build software. We built the Flask dashboard, the logging, and the gated classifier.
5. Simulate. We derived the leg kinematics and developed the gait in MuJoCo, with the servos limited to their real torque, before risking the hardware.
6. Validate. Bench tests, logged sessions, camera scans and leg actuation on the real robot.

The guiding principle was that every design change had to come from a measurement or an analysis, not a guess.`,

  "Key Technical Decisions Since Review III": `[60 s]
These are the main changes since Review III, with the reason for each.

- The Jetson Orin Nano is gone. It needs a 9 to 19 volt supply and dissipates 7 to 25 watts inside a PLA body, which softens near 60 °C. It also barely fitted the bay, and a fall would put an expensive board at risk. Inference now runs on a laptop, which needs no GPU for one image at a time.
- The IMX219 CSI camera was replaced, because the ESP32-S3 has no MIPI-CSI interface. We use an ESP32-CAM that streams over Wi-Fi.
- ROS 2 and MQTT were replaced with plain HTTP and JSON to a Flask server. That means fewer moving parts, with all devices on one local network.
- Gazebo was replaced with MuJoCo. In Gazebo the robot never held a stable stance, while MuJoCo models torque-limited servos directly.
- The LiPo battery came off the robot for safety during bench work.

If asked:
- "Isn't this a step back from onboard AI?" For monitoring, a few images a minute is enough, and the laptop does that in under 100 milliseconds with no risk to the hardware.`,

  "System Architecture": `[50 s]
There are three parts, all on one Wi-Fi hotspot hosted by the laptop, which always takes the address 192.168.137.1.

- The sensor node is a Seeed XIAO ESP32-S3 on its expansion board. It reads the SGP30 gas sensor and the MCP9808 temperature sensor over I2C, the PPD42 dust sensor on a digital pin, and two ultrasonic sensors. It has its own OLED screen, buzzer and button, and posts a JSON record every five seconds.
- The camera node is an ESP32-CAM with an OV3660 sensor. It streams Motion-JPEG video on port 81, serves single photos on port 80, and registers itself with the dashboard at boot.
- The laptop runs the Flask dashboard: it logs every reading to CSV, runs the classifier, and relays the video to every viewer.

The robot carries only two cheap microcontrollers, and all the heavy computation is on the laptop. Any phone on the hotspot can open the dashboard.`,

  "Data Flow: From Sensor to Tagged Diagnosis": `[50 s]
There are two data streams.

Sensor stream:
1. The node samples gas every second, temperature every two seconds, and dust over 30-second windows.
2. Every five seconds it posts a JSON record to /api/sensors on the laptop.
3. The dashboard grades each reading good, moderate or high.
4. It appends the reading to a daily CSV file and updates the live cards.

Camera stream:
1. The ESP32-CAM streams Motion-JPEG.
2. The dashboard holds one connection to the camera and relays frames to every browser, so extra viewers add no load on the camera.
3. On a scan, the frame goes through the vegetation gate and then MobileNetV2.
4. The image is saved with a banner showing crop, condition and confidence, together with the sensor readings at that moment.

That last step is the link between plant health and the environment around the plant.`,

  "Sensor Node Hardware": `[45 s]
This is the sensor node, with live readings and its IP address on the OLED.

The table shows each sensor:
- The SGP30 for TVOC and eCO2, the MCP9808 for temperature, and the PPD42 dust sensor are all live.
- The ultrasonic sensors have complete firmware but are not wired on this build. In the simulation they are what detects the end of each row.

One electrical detail matters here. The XIAO's pins tolerate only 3.3 volts, but the PPD42 outputs about 4 volts and the ultrasonic echo is 5 volts. So each of those signals goes through a 1 kΩ / 2 kΩ divider, which brings 5 V down to 3.33 V and 4 V down to 2.67 V, still a clean logic high.

If asked:
- "Why is the SGP30 read every second?" Its on-chip baseline compensation expects a 1 Hz read rate, and its first 15 seconds are flagged as warm-up.
- "eCO2 versus real CO2?" eCO2 is estimated from VOCs; it is not a true CO2 measurement.`,

  "Firmware Algorithms": `[60 s]
These are the firmware algorithms, several of which came from faults we found in testing.

- Dust. The PPD42 pulls its output low while particles pass its light beam. An interrupt on every edge measures the total low time over a 30-second window. The low percentage r goes into the manufacturer's curve, C = 1.1 r³ − 3.8 r² + 520 r + 0.62 particles per 0.01 cubic foot.
- Absent-sensor detection. With the PPD42 unplugged, the pin read low for the whole window, and the curve reported 1.1 million particles and sounded the alarm. Now a window with no edges and a low line is reported as "absent", and the pin has a pull-down.
- Range. Range uses the speed of sound corrected for temperature, c = 331.3 + 0.606 T. A fixed 343 m/s would be about 3 percent off at 35 °C.
- Ultrasonic crosstalk. The two ultrasonic sensors fire alternately so neither hears the other's ping, and each reading is a median of three.
- Wi-Fi diagnostics. These traced a weak −78 dBm link to a missing antenna; with the antenna fitted it reads −26 dBm.
- Camera self-registration. The camera announces its own address to the dashboard, so a new IP needs no setup.`,

  "Gated Leaf-Disease Classification": `[60 s]
This is the classification pipeline.

The classifier is MobileNetV2 fine-tuned on PlantVillage, with 38 classes across 14 crops. It is closed-set: it has no "not a leaf" answer. When we pointed the camera at an empty room, it said "orange, citrus greening" with 82 to 90 percent confidence.

So we added a vegetation gate before the classifier. The frame is shrunk to 160 by 120 pixels and converted to HSV. A pixel counts as leaf-coloured if its hue is between 38 and 165 degrees (green through the yellow of sick leaves), its saturation is at least 0.2, and its value is at least 0.12. If less than 12 percent of the frame is leaf-coloured, we report "no leaf in view" and hide the model's answer.

The four frames on the right:
- A fallen dry leaf is rejected at 0 percent.
- A hedge seen from a metre away is rejected at 10 percent.
- A close-up plant is accepted at 61 percent.
- Spotted leaves are accepted at 24 percent. The brown lesions don't count as leaf-coloured, but the green tissue around them keeps diseased leaves above the threshold.

After the gate, a top probability below 50 percent is reported as uncertain.`,

  "Locomotion Design: Kinematics, Gait, Centre of Mass": `[60 s]
For locomotion, each leg has three joints (abduction, hip and knee), with measured femur and tibia lengths of 111 and 125 millimetres.

- Inverse kinematics. We derived the closed-form inverse kinematics: given a foot target, it returns the three joint angles directly. We checked it against MuJoCo's own forward kinematics at 1,280 targets, and the worst error was below 10⁻⁷ metres, which is effectively exact.
- Gait. The gait is a diagonal trot at 2 hertz with a duty factor of 0.6. Feet lift 30 millimetres in a raised-cosine swing, and the body height is 180 millimetres. A levelling term uses roll and pitch to adjust leg heights.
- Centre of mass. All four knees point backward, so the legs' mass hangs behind the body centre, and the centre of mass ends up 12 millimetres aft. In a trot the robot stands on two diagonal feet, and the line between them passes through the body centre, in front of the centre of mass, so the robot tips backward. With footholds centred on the body, the trot fell in all 24 gait settings we tried. With footholds centred on the measured centre of mass, tilt stayed below 0.7 degrees.`,

  "Simulation Model in MuJoCo": `[45 s — play the clip]
This is our MuJoCo simulation.

- The robot is built from the measured geometry: 140 by 78 millimetre hip spacing, the measured leg lengths, 1.35 kilograms in total.
- Every joint is a position servo whose torque is capped at 1.0 newton-metre, between the MG996R stall values at 4.8 and 6 volts. So if the gait works here, it is not relying on unrealistic motors.
- The field has four rows of tomato plants, a patch of stressed plants that emits VOCs, and a dusty headland.
- The mission is autonomous. The robot stands up, trots down each row gap under heading control, and when the front ultrasonic reads under 55 centimetres it knows it has reached the hedge, turns, and starts the next row. Along the way it logs simulated gas, dust and temperature.

The gait parameters were chosen by sweeping 24 combinations of frequency, duty factor, servo stiffness and levelling gain.

If asked:
- "Why MuJoCo over Gazebo?" Its position actuators clamp torque the way a real servo does, and it ran stably and fast enough to sweep many settings.`,

  "Technology Stack": `[20 s]
Briefly, the stack:
- Firmware in C++ on the Arduino ESP32 core.
- The dashboard in Python with Flask, using PyTorch and Hugging Face Transformers for the model.
- MuJoCo, NumPy and Matplotlib for the simulation.
- The chassis is based on the SpotMicro design, credited under its Creative Commons licence, with Python scripts generating our custom mounts.

Everything is in one public GitHub repository with run instructions.`,

  "03|Completion and Integration": `[5 s]
Next, what we completed and how it fits together.`,

  "Scope Delivered": `[45 s]
Of six objectives, four are fully achieved and two partly.

Achieved:
- The chassis is printed and adapted, with its geometry measured.
- Camera streaming and gated classification work.
- The dashboard logs and tags.
- The kinematics are verified and the gait works in simulation.

Partly achieved:
- Sensing is complete for gas, dust and temperature. The ultrasonic sensors have firmware ready but are not wired.
- Walking on the physical robot: the legs move and it stands, but it cannot yet step.

We would rather show you these honestly than overstate them. Each has a clear next step, which we cover in future work.`,

  "The Assembled Robot": `[30 s]
This is the assembled robot.
- It has 35 printed parts, about 700 grams of PLA+ with TPU feet, at a printing cost of about ₹5,200.
- The sensor node and breadboard sit on the printed top cover, with the external Wi-Fi antenna raised on a standoff.
- The ESP32-CAM sits in the head and looks out through the printed nose.
- There is no battery on board: the payload runs from a USB power bank beside the robot, which is safer for bench work.`,

  "Integrated Dashboard": `[40 s — then switch to the live dashboard]
This is the dashboard as it ran on 18 October, with live readings from the sensor node.

- Four cards show eCO2, TVOC, dust and temperature. Each has a status band and a short history chart. The TVOC bands of 220 and 660 ppb follow the German Federal Environment Agency guideline. If the node goes silent for 15 seconds it is marked offline.
- Every reading goes to a daily CSV file.
- The camera panel shows live video, a scan button and an image-upload fallback, and the diagnosis panel shows the top three classes.

I will show this live in the demo.`,

  "Stable Operation over Wi-Fi": `[45 s]
This chart shows stable operation.

It is a 17-minute session on 14 October, with TVOC logged every five seconds while we repeatedly exposed the gas sensor to VOC sources. The red and amber lines are the high and moderate bands. TVOC peaked at 1,764 ppb and fell back to baseline within tens of seconds after each exposure.

Across the two logged sessions, 28 and 17 minutes long, we recorded 321 and 199 readings with no records lost. The Wi-Fi signal stayed between −26 and −60 dBm, which is plenty for a reading every five seconds.

If asked:
- "What were the VOC sources?" Common household sources, such as breath and alcohol-based sanitiser, held near the sensor. The point is the response and recovery, not the absolute value.`,

  "Live Demonstration": `[demo, 4–6 min]
Now the live demo. The order:

1. Dashboard. Open 192.168.137.1:5000 and show the three status pills: sensor node, camera and classifier.
2. Breath test. Breathe on the SGP30: eCO2 and TVOC rise within seconds, then recover.
3. Touch test. Hold the MCP9808: the temperature climbs by 3 to 4 degrees.
4. Leaf scan. Hold a leaf to the camera and press Scan to show a diagnosis. Then point the camera away and scan again to show "no leaf in view".
5. Simulation. Run run_sim.bat to show the autonomous survey.
6. Robot. Power the servos to show it standing and moving its legs.

Backup plans:
- If the camera Wi-Fi is unreliable, use "Upload image" with a saved leaf photo.
- If the sensor node is offline, run fake_sensors.py to drive the dashboard.

Before the review:
- Turn on the laptop's Mobile Hotspot first, then power both boards.
- Give the ESP32-CAM its own power supply; it browns out when it shares one.`,

  "04|Testing and Results": `[5 s]
Now testing and results.`,

  "Bench Validation of the Hardware": `[60 s]
Every test applied a known change and checked the response. These numbers are measured on the real hardware.

- Breath on the SGP30: eCO2 went from 400 to 746 ppm and TVOC from 0 to 210 ppb within 5 seconds, then back to baseline.
- A finger on the MCP9808: 31.5 to 35.0 °C in about 10 seconds.
- The PPD42 in room air: 0 to 5,065 particles per 0.01 cubic foot, varying from one 30-second window to the next.
- With the PPD42 unplugged, it is now reported as absent instead of a false 1.1 million.
- Wi-Fi: −78 dBm with time-outs, and −26 dBm once the antenna was fitted.
- Camera video: from about 0.5 to 16–20 frames per second after we moved to MJPEG streaming.
- Servos: on its back, all four legs follow their commands. Standing, it holds a stance and shifts its legs, but slowly.`,

  "Classifier Validation: The Gate Prevents False Diagnoses": `[50 s]
This is the key result for classification.

On the left, without the gate: a photo of an empty room was diagnosed as citrus greening at 82 to 90 percent confidence. That is the danger of a closed-set model.

On the right, with the gate: the same frames measured 0 to 0.1 percent leaf coverage and were rejected, with no diagnosis shown.

Below:
- The gate accepted all 12 PlantVillage leaf images we tested, at 27 to 76 percent coverage.
- In a spot check of 10 images of known class, 8 were correct with over 92 percent confidence, 1 was correct but below threshold so it was reported as uncertain, and 1 tomato leaf-mould image was wrongly labelled late blight.
- Inference takes 30 to 80 milliseconds on the laptop CPU.

To be clear: these are functional checks, not a field-accuracy figure. The images are few, and most come from the dataset the model was trained on.`,

  "Live Scans Outdoors with the Robot's Camera": `[45 s]
These are three outdoor scans with the robot's camera on 18 October.

- Left, a hedge from about a metre away. Only 11 percent of the frame was leaf-coloured, just under the threshold, so the model's 75.5 percent "black rot" was withheld and the user is asked to bring a leaf closer.
- Middle, a potted plant outside the training set. It passed with 60 percent coverage, but the label "healthy corn" came at only 53.4 percent, just above our 50 percent threshold. We did not identify the plant independently, so we do not count this as right or wrong. The low confidence is the warning sign.
- Right, a photograph of spotted leaves on a screen, flagged as black rot at 80.5 percent, with the sensor readings saved alongside the image.

The ESP32-CAM's washed-out colours put some real foliage close to the threshold. Holding the leaf close fixes that.`,

  "Actuation Trials on the Physical Robot": `[60 s — play both clips]
These are our first actuation trials on the printed robot.

- Left, the robot on its back, so the servos carry only the legs. All four legs move through their commanded angles. That confirms the servo wiring, the joint directions and the control signals.
- Right, standing on its own feet. It holds its weight and shifts its legs and body, but the motion is slow, small and visibly strained, and it does not take a step.

This matches our analysis. In a four-foot stance, the knee needs 36 to 52 percent of a genuine MG996R's rated torque, and more when a leg lifts and the other legs take its share. Inexpensive copies of the MG996R often deliver less than rated, and twelve servos moving together draw several amps, so a sagging supply cuts the torque further.

Next steps, in order of cost:
1. A dedicated 6-volt servo supply.
2. Footholds centred on the centre of mass, from the simulation.
3. A taller stance with straighter legs, which shortens the knee's lever arm: about 76 mm at 180 mm height, 43 mm at 220 mm.
4. Stronger servos if the margin is still too thin.

If asked:
- "Which is it, the servos or the supply?" We have not yet separated the two by measurement. That is the first future-work item.`,

  "Simulated Autonomous Field Survey": `[45 s]
This is the result of the full simulated survey.

The robot walked 16.7 metres in 129 seconds and covered all three row gaps with no falls. The front ultrasonic detected all three row ends. Body tilt stayed under 2.7 degrees, and a servo was at its torque limit only 1.3 percent of the time.

The route is coloured by measured TVOC, and it turns red over the stressed patch. The peak was 535 ppb, but it sits 0.2 metres from the true source. The reason is that the gas sensor responds with about a 2.5-second lag while the robot keeps walking, so the peak is smeared along the path. This is a real effect worth planning for: pausing at waypoints or correcting for the sensor's known response would fix it.`,

  "Gait Stability and the Servo Speed Limit": `[50 s]
These are two findings that matter for the real robot.

- Left chart, commanded against achieved speed. From 0.08 to 0.18 metres per second the robot tracks the command within 7 percent. Above that the achieved speed collapses.
- Middle chart, how often a servo is at its torque limit. It stays at 8 to 34 percent up to 0.18 metres per second, then jumps to 68 percent at 0.20, and the robot falls at 0.22. So the usable ceiling with MG996R servos is about 0.18 metres per second.
- Bottom, the centre-of-mass finding. With footholds centred on the body, every one of 24 gait settings fell within 0.8 to 3 seconds. Centred on the measured centre of mass, tilt stayed below 0.7 degrees.

If asked:
- "Why does 0.24 look better than 0.22?" It stayed upright but reached only 0.166 m/s with 77 percent saturation, so it is not usable either.`,

  "Outcome Against Review III Expectations": `[40 s]
Comparing honestly with what we planned at Review III:
- Onboard inference on a Jetson became laptop inference over Wi-Fi. It is cheaper and safer, but depends on the network.
- We cited above 90 percent accuracy from the literature. We did not measure field accuracy; our classification is a functional demonstration.
- The Review III torque analysis said the margin was thin. The simulation confirmed it, with a 0.18 m/s ceiling, and so did the hardware.
- A walking robot: it stands and moves its legs, and walking is shown in simulation. Walking on hardware is the next phase.
- The sensing payload is essentially complete.`,

  "05|Innovation and Relevance": `[5 s]
Now what is new, and why it matters in practice.`,

  "Contributions": `[45 s]
We see four contributions.

1. A legged platform with a crop-sensing payload: a printed quadruped carrying two Wi-Fi nodes for gas, dust, temperature, range and video.
2. A vegetation gate for a closed-set classifier: a simple, explainable leaf check that stops confident disease reports on frames with no plant.
3. Locomotion validated against real servo limits: a physics model built from measured geometry, with torque capped at MG996R stall, completing an autonomous row survey.
4. Design rules for printed quadrupeds: centre the footholds on the measured centre of mass, and expect about 0.18 metres per second from MG996R-class servos. These apply to anyone building a SpotMicro-type robot.`,

  "Cost and Feasibility": `[40 s]
On cost: the purchased and listed parts come to about ₹10,250, made up of:
- ₹5,200 for printing.
- ₹3,996 for twelve servos.
- ₹689 for the ESP32-CAM.
- ₹249 for a servo driver.
- ₹119 for the camera programmer.

The XIAO, the sensors and the wiring were already available to the team, so they are not costed here.

For comparison, the surveyed papers report Stanford Doggo under 3,000 US dollars, MIT Cheetah 3 around 50,000, and ANYmal over 100,000.

So the approach is within reach of a student lab, and potentially a small farm. The trade-off is lower performance, which we have quantified.`,

  "Ethical and Responsible Use": `[50 s]
The rubric asks about ethics. These are design choices we made deliberately.

- Data stays local. Everything stays on the laptop's own hotspot: no cloud, no personal data, and the camera points at crops.
- No false certainty. The gate and the 50 percent threshold suppress unreliable labels, and the results are presented as indications for an agronomist, not a spray decision. Over-spraying because of a false diagnosis would harm crops and the environment.
- Safety. The payload runs on low-voltage USB, there is no LiPo on board, and the robot is slow.
- Honest sensor claims. eCO2 is estimated and the dust sensor is uncalibrated, so we use them for trends and alerts, not regulatory values.
- Open source with attribution. The SpotMicro design is credited under its CC-BY licence, and our code is public.
- Accessibility. Low-cost parts and no internet requirement put it within reach of smallholders.`,

  "Practical Applicability": `[35 s]
In practice, it could be used for:
- Row-by-row scouting: walking the rows, logging air conditions, and scanning suspicious leaves on the way.
- Early-warning hotspots: rising VOC readings along a row point to stressed plants before symptoms spread.
- Nurseries and greenhouses: repeated inspection in narrow aisles where wheels struggle.
- Records for agronomists: each image is tagged with the conditions at capture, which gives an evidence trail.

To run it, a farm needs only a laptop with a hotspot, the robot, a USB power bank, and any phone to view the dashboard. No internet or cloud account is needed.`,

  "Limitations": `[45 s]
We want to state the limitations ourselves.

- The real servos lack torque reserve, so the robot stands but does not step. We have a clear fix path.
- The classifier was trained on lab photos of 14 crops, so accuracy on field images will be lower, and any plant passes the gate, even an untrained crop.
- The ESP32-CAM's washed-out colours put some real foliage near the 12 percent threshold. The threshold should be tuned to this camera.
- eCO2 is estimated and the PPD42 is uncalibrated, so the readings are relative.
- The gas and dust fields in the simulation are modelled, so the simulation demonstrates the method rather than field data.`,

  "Future Work": `[40 s]
Future work, in order of what it unlocks:

1. Walking on hardware. A dedicated 6-volt servo supply, measuring torque and voltage under load, then the centre-of-mass footholds and a taller stance. Then stepping in place, and walking below 0.18 metres per second.
2. Complete the sensor set. Wire the ultrasonic sensors, add a soil-moisture probe, and calibrate against reference instruments.
3. Act on measurements. Use the Grove relay we have to switch an irrigation pump or raise an alarm from the dashboard.
4. Field-ready classification. Fine-tune on images from the robot's own camera, and replace the colour gate with a learned open-set detector.
5. Mapping and autonomy. Correct for the gas sensor's lag, log positions to build field maps, and add a battery for untethered runs.`,

  "Conclusion": `[40 s]
To conclude:
- The sensing works end to end: two wireless nodes, a live dashboard with logging, and leaf-disease classification that refuses to guess without a leaf.
- Locomotion is validated in physics: a full autonomous row survey without a fall, with servos capped at their real torque.
- The printed robot moves: all twelve servos drive the legs and it stands, though with too little torque reserve to step, exactly as our analysis predicted.
- We leave two design rules for the next build: centre the footholds on the centre of mass, and expect about 0.18 metres per second from MG996R servos.

All the code, print files and results are on GitHub. Thank you. We are happy to take questions.`,

  References: `Reference list: papers 1–18 are the surveyed literature; 19–24 are the sources for crop-loss figures, the dataset, MobileNetV2, MuJoCo, the colour-index idea behind the gate, and the SpotMicro design. Skip this slide in the talk unless asked.`,

  __thanks: `Questions.

Likely questions and short answers:
- "Why ESP32 and not a Raspberry Pi?" Lower cost and power, and nothing expensive at risk in a fall. The laptop does the heavy computation.
- "How accurate is the classifier?" On PlantVillage-style images it is high, as the literature reports. We did not measure field accuracy. Our contribution is guarding it with the gate and the confidence threshold.
- "Why HSV thresholds and not another network?" They are simple and explainable, need no training data, and fix the most visible failure. A learned open-set detector is future work.
- "Why does the real robot not walk?" Thin torque margin, predicted at Review III and confirmed in simulation. Next comes a dedicated supply, CoM footholds and a taller stance.
- "What is the novelty?" The integration of a printed legged platform with crop sensing, the gate, and quantified design rules for hobby quadrupeds.
- "What did you personally do?" Be ready to describe your own modules in one or two sentences each.`,
};
