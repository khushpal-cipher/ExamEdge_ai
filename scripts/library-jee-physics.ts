// ExamEdge library demo seed: JEE Main Physics (Q-02 default, ADR-027). Chapters follow the NTA JEE Main physics
// syllabus units [U: re-check against the current NTA information bulletin before the pilot]. Topics with an
// explanation and a formula sheet exist only for the four chapters the demo notes cover; the rest of the syllabus
// waits for Opus generation + expert review (BLOCKED). Text is original, written for this seed — not copied.
export type LibraryTopic = { name: string; explanation: string; formulas: string };
export type LibraryChapter = { name: string; topics: LibraryTopic[] };

export const PROVENANCE =
  'Original text written for the ExamEdge demo seed by an AI assistant (Claude) from general physics knowledge on ' +
  '2026-10-16; not copied from any book. Not yet reviewed by a subject expert: demo use only.';
export const AUTHOR_MODEL = 'claude-opus-5-5';

const UNITS: LibraryTopic[] = [
  {
    name: 'SI units and dimensions',
    explanation: `Every physical quantity is a number together with a unit. The SI system is built on seven **base quantities**: length (metre, m), mass (kilogram, kg), time (second, s), electric current (ampere, A), temperature (kelvin, K), amount of substance (mole, mol) and luminous intensity (candela, cd). Every other unit is derived from these; for example the newton is $1\\ N = 1\\ kg\\ m\\ s^{-2}$.

The **dimensions** of a quantity show how it is built from the base quantities and are written in square brackets. Force has dimensions $[M L T^{-2}]$ because it is mass times acceleration. Only quantities with the same dimensions can be added, subtracted or compared. Ratios of like quantities, such as strain, refractive index or an angle in radians, are **dimensionless**. Two different quantities can share dimensions: work and torque are both $[M L^2 T^{-2}]$.`,
    formulas: `**Common dimensional formulas**
- Velocity $[L T^{-1}]$, acceleration $[L T^{-2}]$
- Force $[M L T^{-2}]$, momentum and impulse $[M L T^{-1}]$
- Work, energy and torque $[M L^2 T^{-2}]$, power $[M L^2 T^{-3}]$
- Pressure and stress $[M L^{-1} T^{-2}]$
- Gravitational constant $G$: $[M^{-1} L^3 T^{-2}]$
- Planck's constant $h$ and angular momentum: $[M L^2 T^{-1}]$

**Large and small lengths**
- 1 light year $\\approx 9.46 \\times 10^{15}$ m
- 1 astronomical unit $\\approx 1.496 \\times 10^{11}$ m
- 1 parsec $\\approx 3.08 \\times 10^{16}$ m
- 1 angstrom = $10^{-10}$ m, 1 fermi = $10^{-15}$ m`,
  },
  {
    name: 'Dimensional analysis',
    explanation: `Dimensional analysis has three uses. First, **checking an equation**: by the principle of homogeneity every term of a correct equation has the same dimensions, so $s = ut + \\frac{1}{2}at^2$ passes because each term is a length. Second, **converting units**: if a quantity has dimensions $[M^a L^b T^c]$, its value changes as $n_2 = n_1 (M_1/M_2)^a (L_1/L_2)^b (T_1/T_2)^c$. Third, **guessing a relation**: assume the period of a pendulum is $T = k\\, l^a g^b m^c$; matching powers of M, L and T gives $c = 0$, $b = -\\frac{1}{2}$, $a = \\frac{1}{2}$, so $T = k\\sqrt{l/g}$ (experiment gives $k = 2\\pi$).

**Limits:** the method cannot find dimensionless constants like $2\\pi$, cannot derive equations that add several terms or contain sine, log or exponential functions, and cannot decide between quantities with the same dimensions. With only M, L and T it can fix at most three unknown powers.`,
    formulas: `- Principle of homogeneity: every term of a valid equation has the same dimensions
- Unit conversion: $n_2 = n_1 \\left(\\frac{M_1}{M_2}\\right)^a \\left(\\frac{L_1}{L_2}\\right)^b \\left(\\frac{T_1}{T_2}\\right)^c$
- $1\\ J = 10^7$ erg, $1\\ N = 10^5$ dyne
- Simple pendulum (from dimensions + experiment): $T = 2\\pi\\sqrt{l/g}$
- Arguments of sin, cos, log and exp must be dimensionless`,
  },
  {
    name: 'Errors and significant figures',
    explanation: `Every measurement has an **error**. For repeated readings, the absolute error of a reading is $\\Delta a_i = |\\bar{a} - a_i|$, the mean absolute error is their average, the relative error is $\\Delta a / \\bar{a}$ and the percentage error is that ratio times 100.

When results are combined, errors grow. For a **sum or difference**, absolute errors add: $\\Delta(A \\pm B) = \\Delta A + \\Delta B$. For a **product or quotient**, relative errors add: $\\Delta Z / Z = \\Delta A/A + \\Delta B/B$. For a **power** $Z = A^n$, the relative error is multiplied by $n$, which is why the quantity with the highest power matters most.

**Significant figures:** all non-zero digits count; zeros between them count; leading zeros never count; trailing zeros count only after a decimal point. After multiplying or dividing, keep as many significant figures as the least precise value; after adding or subtracting, keep as many decimal places as the least precise value. The **least count** of a vernier calliper is 1 MSD − 1 VSD; of a screw gauge it is pitch ÷ number of circular-scale divisions.`,
    formulas: `- Relative error: $\\delta a = \\Delta a / a$; percentage error $= \\delta a \\times 100\\%$
- $Z = A \\pm B$: $\\Delta Z = \\Delta A + \\Delta B$
- $Z = AB$ or $A/B$: $\\frac{\\Delta Z}{Z} = \\frac{\\Delta A}{A} + \\frac{\\Delta B}{B}$
- $Z = \\frac{A^p B^q}{C^r}$: $\\frac{\\Delta Z}{Z} = p\\frac{\\Delta A}{A} + q\\frac{\\Delta B}{B} + r\\frac{\\Delta C}{C}$
- Vernier calliper least count = 1 MSD − 1 VSD
- Screw gauge least count = pitch / number of circular scale divisions`,
  },
];

const MOTION: LibraryTopic[] = [
  {
    name: "Newton's laws and momentum",
    explanation: `**First law:** a body keeps its state of rest or uniform straight-line motion unless a net external force acts. This tendency is inertia, and mass measures it.

**Second law:** the net force equals the rate of change of momentum, $\\vec{F} = d\\vec{p}/dt$; for constant mass $\\vec{F} = m\\vec{a}$. A force acting for a time gives an **impulse** $J = F\\Delta t$ equal to the change in momentum, which is why catching a ball over a longer time needs a smaller force.

**Third law:** forces come in equal and opposite pairs acting on **different** bodies, so they never cancel on one free-body diagram. When no net external force acts on a system, its total momentum is conserved: a gun recoils so that $m_1 v_1 + m_2 v_2 = 0$.

In a lift accelerating upward at $a$, the floor pushes with $N = m(g + a)$, so you feel heavier; moving down with acceleration $a$ gives $N = m(g - a)$, and in free fall $N = 0$.`,
    formulas: `- $\\vec{p} = m\\vec{v}$, $\\vec{F}_{net} = \\frac{d\\vec{p}}{dt} = m\\vec{a}$ (constant mass)
- Impulse $J = \\int F\\,dt = \\Delta p$
- No external force: $\\sum m_i \\vec{v}_i$ = constant; recoil $m_1 v_1 = -m_2 v_2$
- Apparent weight in a lift: up $N = m(g + a)$, down $N = m(g - a)$
- Atwood machine: $a = \\frac{(m_1 - m_2)g}{m_1 + m_2}$, $T = \\frac{2 m_1 m_2 g}{m_1 + m_2}$`,
  },
  {
    name: 'Friction',
    explanation: `Friction opposes relative motion (or its tendency) between surfaces in contact. **Static friction** adjusts itself to match the applied force, up to a maximum $f_{s,max} = \\mu_s N$. Once the body slides, **kinetic friction** $f_k = \\mu_k N$ acts, and normally $\\mu_k < \\mu_s$, which is why it is harder to start pushing a box than to keep it moving. To a good approximation friction does not depend on the area of contact.

On an incline, a block just begins to slide when $\\tan\\theta = \\mu_s$; this angle is the **angle of repose**. While it slides down, its acceleration is $a = g(\\sin\\theta - \\mu_k\\cos\\theta)$.

Pulling at an angle $\\theta$ above the horizontal reduces the normal force, so the force needed to start motion is $F = \\frac{\\mu mg}{\\cos\\theta + \\mu\\sin\\theta}$; it is smallest when $\\tan\\theta = \\mu$. Rolling friction is much smaller than sliding friction, which is why wheels and ball bearings help.`,
    formulas: `- Static: $f_s \\le \\mu_s N$; kinetic: $f_k = \\mu_k N$; usually $\\mu_k < \\mu_s$
- Angle of repose: $\\tan\\theta_r = \\mu_s$
- Sliding down an incline: $a = g(\\sin\\theta - \\mu_k\\cos\\theta)$
- Pushed up an incline at constant speed: $F = mg(\\sin\\theta + \\mu_k\\cos\\theta)$
- Pull at angle $\\theta$: $F = \\frac{\\mu mg}{\\cos\\theta + \\mu\\sin\\theta}$, minimum $\\frac{\\mu mg}{\\sqrt{1+\\mu^2}}$ at $\\tan\\theta = \\mu$`,
  },
  {
    name: 'Circular motion and banking of roads',
    explanation: `A body moving in a circle of radius $r$ at speed $v$ accelerates towards the centre with $a_c = v^2/r = \\omega^2 r$, so a net inward (**centripetal**) force $mv^2/r$ must act. It is not a new kind of force: tension, friction, the normal force or gravity provides it.

On a **flat road**, only friction holds a car on the curve, so the maximum safe speed is $v_{max} = \\sqrt{\\mu r g}$. Roads are **banked** at an angle $\\theta$ so that part of the normal force points to the centre; with no friction the ideal speed satisfies $\\tan\\theta = \\frac{v^2}{rg}$. With friction, the maximum speed rises to $v_{max} = \\sqrt{rg\\frac{\\mu + \\tan\\theta}{1 - \\mu\\tan\\theta}}$.

In a **vertical circle** on a string, the string stays tight at the top only if $v_{top} \\ge \\sqrt{gr}$, which needs $v_{bottom} \\ge \\sqrt{5gr}$ at the lowest point.`,
    formulas: `- $a_c = \\frac{v^2}{r} = \\omega^2 r$, $F_c = \\frac{mv^2}{r}$, $v = \\omega r$
- Flat curve: $v_{max} = \\sqrt{\\mu r g}$
- Banked, no friction: $\\tan\\theta = \\frac{v^2}{rg}$
- Banked with friction: $v_{max} = \\sqrt{rg\\,\\frac{\\mu + \\tan\\theta}{1 - \\mu\\tan\\theta}}$
- Vertical circle (string): $v_{top} \\ge \\sqrt{gr}$, $v_{bottom} \\ge \\sqrt{5gr}$
- Conical pendulum: $\\tan\\theta = \\frac{v^2}{rg}$`,
  },
];

const ROTATION: LibraryTopic[] = [
  {
    name: 'Torque and moment of inertia',
    explanation: `**Torque** is the turning effect of a force about an axis: $\\vec{\\tau} = \\vec{r} \\times \\vec{F}$, with magnitude $rF\\sin\\theta$. The same force turns a body more when it acts farther from the axis, which is why a spanner has a long handle.

**Moment of inertia** $I = \\sum m_i r_i^2$ plays the part of mass in rotation: about a fixed axis $\\tau = I\\alpha$. It depends on how the mass is spread around the axis, not only on the total mass; writing $I = Mk^2$ defines the radius of gyration $k$.

Two theorems save work. **Parallel axis:** $I = I_{cm} + Md^2$ for an axis parallel to one through the centre of mass at distance $d$. **Perpendicular axis** (flat bodies only): $I_z = I_x + I_y$. A rigid body is in equilibrium when both the net force and the net torque about any point are zero.`,
    formulas: `**Moments of inertia (mass M)**
- Thin ring, axis through centre ⟂ plane: $MR^2$; about a diameter: $\\frac{1}{2}MR^2$
- Disc, axis ⟂ plane: $\\frac{1}{2}MR^2$; about a diameter: $\\frac{1}{4}MR^2$
- Solid cylinder about its axis: $\\frac{1}{2}MR^2$
- Solid sphere: $\\frac{2}{5}MR^2$; thin spherical shell: $\\frac{2}{3}MR^2$
- Thin rod, length L, about centre: $\\frac{1}{12}ML^2$; about one end: $\\frac{1}{3}ML^2$

**Rules**
- $\\tau = rF\\sin\\theta$, $\\tau = I\\alpha$, $I = Mk^2$
- Parallel axis $I = I_{cm} + Md^2$; perpendicular axis $I_z = I_x + I_y$`,
  },
  {
    name: 'Angular momentum and its conservation',
    explanation: `The angular momentum of a particle about a point is $\\vec{L} = \\vec{r} \\times \\vec{p}$; for a rigid body turning about a fixed axis it is $L = I\\omega$. Torque changes it: $\\vec{\\tau} = d\\vec{L}/dt$.

If no external torque acts, **angular momentum is conserved**: $I_1\\omega_1 = I_2\\omega_2$. A diver tucks in to spin faster and opens out before entering the water; a collapsing star spins up enormously. The kinetic energy $K = \\frac{1}{2}I\\omega^2 = \\frac{L^2}{2I}$ is **not** conserved in these cases: when $I$ falls at constant $L$, $K$ rises, and the extra energy comes from the work the person does pulling the arms in.

Rotation about a fixed axis uses equations just like straight-line motion with constant acceleration, with $\\theta$, $\\omega$ and $\\alpha$ in place of $s$, $v$ and $a$. Work done by a torque is $\\tau\\theta$ and power is $\\tau\\omega$.`,
    formulas: `- $\\vec{L} = \\vec{r} \\times \\vec{p}$; rigid body: $L = I\\omega$; $\\vec{\\tau} = \\frac{d\\vec{L}}{dt}$
- No external torque: $I_1\\omega_1 = I_2\\omega_2$
- $K_{rot} = \\frac{1}{2}I\\omega^2 = \\frac{L^2}{2I}$, $W = \\tau\\theta$, $P = \\tau\\omega$
- $\\omega = \\omega_0 + \\alpha t$, $\\theta = \\omega_0 t + \\frac{1}{2}\\alpha t^2$, $\\omega^2 = \\omega_0^2 + 2\\alpha\\theta$`,
  },
  {
    name: 'Rolling motion',
    explanation: `In **rolling without slipping** the contact point is momentarily at rest, so the centre moves at $v_{cm} = \\omega R$. The kinetic energy has a translational and a rotational part: $K = \\frac{1}{2}mv^2 + \\frac{1}{2}I\\omega^2 = \\frac{1}{2}mv^2\\left(1 + \\frac{k^2}{R^2}\\right)$.

Down an incline of angle $\\theta$, a body that rolls without slipping accelerates at $a = \\frac{g\\sin\\theta}{1 + k^2/R^2}$ and reaches the bottom of a height $h$ with $v = \\sqrt{\\frac{2gh}{1 + k^2/R^2}}$. The smaller $k^2/R^2$, the faster it rolls, so in a race down the same slope the solid sphere ($\\frac{2}{5}$) wins, then the disc or solid cylinder ($\\frac{1}{2}$), then the hollow sphere ($\\frac{2}{3}$), and the ring ($1$) comes last — whatever their masses and radii.

Static friction is what makes the body roll, but in pure rolling the contact point does not slide, so this friction does no work and mechanical energy is conserved.`,
    formulas: `- No slipping: $v_{cm} = \\omega R$, $a_{cm} = \\alpha R$
- $K = \\frac{1}{2}mv^2\\left(1 + \\frac{k^2}{R^2}\\right)$
- Incline: $a = \\frac{g\\sin\\theta}{1 + k^2/R^2}$, $v = \\sqrt{\\frac{2gh}{1 + k^2/R^2}}$
- $k^2/R^2$: ring 1, hollow sphere $\\frac{2}{3}$, disc/solid cylinder $\\frac{1}{2}$, solid sphere $\\frac{2}{5}$
- Fraction of KE that is rotational: $\\frac{k^2/R^2}{1 + k^2/R^2}$ (ring $\\frac{1}{2}$, disc $\\frac{1}{3}$, solid sphere $\\frac{2}{7}$)`,
  },
];

const GRAVITATION: LibraryTopic[] = [
  {
    name: "Newton's law of gravitation and g",
    explanation: `Every two masses attract with a force along the line joining them: $F = \\frac{G m_1 m_2}{r^2}$, where $G = 6.67 \\times 10^{-11}\\ N\\,m^2\\,kg^{-2}$. A uniform spherical shell attracts an outside mass as if all its mass were at its centre, and exerts **no** net force on a mass inside it.

At the Earth's surface this gives $g = \\frac{GM}{R^2} \\approx 9.8\\ m/s^2$. Going **up** a height $h$, $g_h = g\\left(1 + \\frac{h}{R}\\right)^{-2} \\approx g\\left(1 - \\frac{2h}{R}\\right)$ when $h \\ll R$. Going **down** a depth $d$, only the mass below you pulls, so $g_d = g\\left(1 - \\frac{d}{R}\\right)$, which is zero at the centre. Because the Earth spins, the effective value also changes with latitude $\\phi$: $g' = g - \\omega^2 R\\cos^2\\phi$, smallest at the equator.

The gravitational potential at distance $r$ from a mass $M$ is $V = -\\frac{GM}{r}$, and the potential energy of a mass $m$ there is $U = -\\frac{GMm}{r}$ (zero at infinity).`,
    formulas: `- $F = \\frac{G m_1 m_2}{r^2}$, $G = 6.67 \\times 10^{-11}\\ N\\,m^2/kg^2$
- $g = \\frac{GM}{R^2} = \\frac{4}{3}\\pi G\\rho R$
- Height: $g_h = \\frac{g}{(1 + h/R)^2} \\approx g\\left(1 - \\frac{2h}{R}\\right)$
- Depth: $g_d = g\\left(1 - \\frac{d}{R}\\right)$
- Latitude: $g' = g - \\omega^2 R\\cos^2\\phi$
- $V = -\\frac{GM}{r}$, $U = -\\frac{GMm}{r}$`,
  },
  {
    name: 'Escape velocity and orbital velocity',
    explanation: `A satellite in a circular orbit of radius $r$ needs gravity to supply the centripetal force, which gives the **orbital velocity** $v_o = \\sqrt{\\frac{GM}{r}}$ and the period $T = 2\\pi\\sqrt{\\frac{r^3}{GM}}$. Close to the surface $v_o = \\sqrt{gR} \\approx 7.9\\ km/s$.

**Escape velocity** is the smallest launch speed that lets a body reach infinity: setting its total energy to zero gives $v_e = \\sqrt{\\frac{2GM}{R}} = \\sqrt{2gR} \\approx 11.2\\ km/s$ for the Earth. It does not depend on the body's mass or the direction of launch, and $v_e = \\sqrt{2}\\,v_o$ for an orbit near the surface.

For an orbiting satellite, $KE = \\frac{GMm}{2r}$, $PE = -\\frac{GMm}{r}$, so the total energy is $E = -\\frac{GMm}{2r}$; the binding energy $\\frac{GMm}{2r}$ is the energy needed to free it. A **geostationary** satellite orbits above the equator, west to east, with a 24-hour period, about 36,000 km above the surface (orbit radius about 42,200 km).`,
    formulas: `- Orbital speed $v_o = \\sqrt{\\frac{GM}{r}}$; near the surface $v_o = \\sqrt{gR} \\approx 7.9$ km/s
- Period $T = 2\\pi\\sqrt{\\frac{r^3}{GM}}$
- Escape speed $v_e = \\sqrt{\\frac{2GM}{R}} = \\sqrt{2gR} \\approx 11.2$ km/s; $v_e = \\sqrt{2}\\,v_o$
- Satellite: $KE = \\frac{GMm}{2r}$, $PE = -\\frac{GMm}{r}$, $E = -\\frac{GMm}{2r}$
- Geostationary: $T = 24$ h, height $\\approx 3.6 \\times 10^4$ km`,
  },
  {
    name: "Kepler's laws",
    explanation: `Kepler found three rules for planetary motion that Newton's gravity later explained.

1. **Law of orbits:** each planet moves in an ellipse with the Sun at one focus.
2. **Law of areas:** the line from the Sun to a planet sweeps out equal areas in equal times. This is conservation of angular momentum (gravity is a central force, so it exerts no torque about the Sun): the areal velocity $\\frac{dA}{dt} = \\frac{L}{2m}$ is constant, so a planet moves fastest at perihelion and slowest at aphelion, with $v_p r_p = v_a r_a$.
3. **Law of periods:** the square of the period is proportional to the cube of the semi-major axis, $T^2 \\propto a^3$. For a circular orbit this follows directly from $T = 2\\pi\\sqrt{r^3/GM}$, so $T^2 = \\frac{4\\pi^2}{GM}r^3$.

The constant in the third law depends only on the mass of the body being orbited, so the same rule links the periods and orbit sizes of all planets of the Sun, or all moons of Jupiter.`,
    formulas: `- Orbits: ellipses with the Sun at a focus
- Areal velocity $\\frac{dA}{dt} = \\frac{L}{2m}$ = constant; $v_p r_p = v_a r_a$
- $T^2 = \\frac{4\\pi^2}{GM}a^3$, so $\\frac{T_1^2}{T_2^2} = \\frac{a_1^3}{a_2^3}$
- Semi-major axis $a = \\frac{r_p + r_a}{2}$`,
  },
];

// NTA JEE Main physics units, in syllabus order; four have topics and content.
export const JEE_PHYSICS: LibraryChapter[] = [
  { name: 'Units and Measurements', topics: UNITS },
  { name: 'Kinematics', topics: [] },
  { name: 'Laws of Motion', topics: MOTION },
  { name: 'Work, Energy and Power', topics: [] },
  { name: 'Rotational Motion', topics: ROTATION },
  { name: 'Gravitation', topics: GRAVITATION },
  { name: 'Properties of Solids and Liquids', topics: [] },
  { name: 'Thermodynamics', topics: [] },
  { name: 'Kinetic Theory of Gases', topics: [] },
  { name: 'Oscillations and Waves', topics: [] },
  { name: 'Electrostatics', topics: [] },
  { name: 'Current Electricity', topics: [] },
  { name: 'Magnetic Effects of Current and Magnetism', topics: [] },
  { name: 'Electromagnetic Induction and Alternating Currents', topics: [] },
  { name: 'Electromagnetic Waves', topics: [] },
  { name: 'Optics', topics: [] },
  { name: 'Dual Nature of Matter and Radiation', topics: [] },
  { name: 'Atoms and Nuclei', topics: [] },
  { name: 'Electronic Devices', topics: [] },
  { name: 'Experimental Skills', topics: [] },
];
