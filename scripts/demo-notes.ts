// Short sample notes for the demo seed (generated into PDFs by make-pdf.ts). One entry per document; each inner
// array is one page. `null` = a page without a text layer (stands in for a scanned page, read by OCR).
export type Note = { subject: string; chapter: string; title: string; pages: (string[] | null)[]; draft?: boolean };

export const NOTES: Note[] = [
  {
    subject: 'Physics',
    chapter: 'Laws of Motion',
    title: 'Laws of Motion – class notes',
    pages: [
      [
        'Chapter 5 Laws of Motion',
        "5.1 Newton's first law",
        'A body stays at rest or in uniform motion in a straight line unless an external force acts on it.',
        'This property is called inertia. Mass is the measure of inertia of a body.',
        "5.2 Newton's second law",
        'The rate of change of momentum is proportional to the applied force: F = dp/dt = ma.',
        'The SI unit of force is the newton (N): 1 N = 1 kg m/s^2.',
        'Impulse J = F x t = change in momentum. A cricketer lowers the hands to increase t and reduce F.',
      ],
      [
        "5.3 Newton's third law",
        'To every action there is an equal and opposite reaction. Action and reaction act on different bodies.',
        '5.4 Friction',
        'Static friction adjusts up to a limit: f_s <= mu_s N. Kinetic friction is f_k = mu_k N, with mu_k < mu_s.',
        'Worked example: a 2 kg block is pulled with 10 N on a floor with mu_k = 0.2 (g = 10 m/s^2).',
        'Friction = 0.2 x 2 x 10 = 4 N, so the net force is 6 N and a = 6 / 2 = 3 m/s^2.',
      ],
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Rotational Motion',
    title: 'Rotational Motion – torque and angular momentum',
    pages: [
      [
        'Chapter 7 Rotational Motion',
        '7.1 Torque',
        'Torque is the turning effect of a force about an axis: tau = r x F, magnitude r F sin(theta).',
        'Its SI unit is N m. A door handle is placed far from the hinge to get more torque for the same force.',
        '7.2 Moment of inertia',
        'Moment of inertia I = sum of m r^2. It plays the role of mass in rotation: tau = I alpha.',
        'Ring about its axis: I = M R^2. Disc about its axis: I = M R^2 / 2. Rod about its centre: M L^2 / 12.',
      ],
      [
        '7.3 Angular momentum',
        'Angular momentum L = I omega. Without external torque, angular momentum is conserved.',
        'A skater pulls in the arms: I decreases, so omega increases and the skater spins faster.',
        '7.4 Rolling without slipping',
        'For rolling, v = omega R. Kinetic energy = (1/2) m v^2 + (1/2) I omega^2.',
      ],
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Gravitation',
    title: 'Gravitation – draft notes',
    draft: true,
    pages: [
      [
        'Chapter 8 Gravitation',
        "Newton's law of gravitation: F = G m1 m2 / r^2, with G = 6.67 x 10^-11 N m^2/kg^2.",
        'Acceleration due to gravity at the surface: g = G M / R^2, about 9.8 m/s^2.',
      ],
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Atomic Structure',
    title: 'Atomic Structure – summary',
    pages: [
      [
        'Chapter 2 Atomic Structure',
        '2.1 Bohr model',
        'Electrons move in fixed orbits with angular momentum m v r = n h / 2 pi.',
        'Energy of the nth orbit of hydrogen: E_n = -13.6 / n^2 eV. The radius grows as n^2.',
        '2.2 Quantum numbers',
        'Principal n, azimuthal l (0 to n-1), magnetic m (-l to +l) and spin s (+1/2 or -1/2).',
        'Pauli exclusion principle: no two electrons in an atom have all four quantum numbers equal.',
        "Aufbau principle and Hund's rule decide the order in which orbitals are filled.",
      ],
      null,
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Bonding',
    title: 'Chemical Bonding – VSEPR and hybridisation',
    pages: [
      [
        'Chapter 4 Chemical Bonding',
        '4.1 VSEPR theory',
        'Electron pairs around the central atom repel and stay as far apart as possible.',
        'Lone pairs repel more than bond pairs, so the angle in water is 104.5 degrees, not 109.5.',
        '4.2 Hybridisation',
        'sp: linear (BeCl2). sp2: trigonal planar (BF3). sp3: tetrahedral (CH4). sp3d: trigonal bipyramidal.',
        'Bond order = (bonding electrons - antibonding electrons) / 2. O2 has bond order 2.',
      ],
    ],
  },
  {
    subject: 'Maths',
    chapter: 'Quadratic Equations',
    title: 'Quadratic Equations – roots and discriminant',
    pages: [
      [
        'Chapter 5 Quadratic Equations',
        'For a x^2 + b x + c = 0, the roots are x = (-b +/- sqrt(b^2 - 4ac)) / 2a.',
        'The discriminant D = b^2 - 4ac. D > 0: two real roots. D = 0: equal roots. D < 0: complex roots.',
        'Sum of roots = -b/a and product of roots = c/a.',
        'Example: x^2 - 5x + 6 = 0 has D = 1, so the roots are 2 and 3.',
      ],
    ],
  },
  {
    subject: 'Maths',
    chapter: 'Limits and Derivatives',
    title: 'Limits and Derivatives – standard results',
    pages: [
      [
        'Chapter 13 Limits and Derivatives',
        'lim (x -> 0) sin x / x = 1 and lim (x -> 0) (e^x - 1) / x = 1.',
        'The derivative is the limit of (f(x + h) - f(x)) / h as h tends to 0.',
        "d/dx x^n = n x^(n-1). d/dx sin x = cos x. Product rule: (uv)' = u'v + uv'.",
      ],
    ],
  },
  {
    subject: 'Biology',
    chapter: 'Cell: The Unit of Life',
    title: 'Cell – organelles at a glance',
    pages: [
      [
        'Chapter 8 Cell: The Unit of Life',
        'Mitochondria are the site of aerobic respiration and make ATP; they have their own DNA.',
        'Ribosomes make proteins. 70S ribosomes in prokaryotes, 80S in eukaryotes.',
        'The cell membrane follows the fluid mosaic model of Singer and Nicolson.',
        'Chloroplasts in plant cells carry out photosynthesis; thylakoids hold the chlorophyll.',
      ],
    ],
  },
  {
    subject: 'Biology',
    chapter: 'Genetics',
    title: "Genetics – Mendel's laws",
    pages: [
      [
        'Chapter 5 Principles of Inheritance',
        'Law of dominance: in a hybrid, one allele (dominant) masks the other (recessive).',
        'Law of segregation: the two alleles separate during gamete formation.',
        'Monohybrid F2 ratio: 3 : 1 (phenotype) and 1 : 2 : 1 (genotype). Dihybrid F2 ratio: 9 : 3 : 3 : 1.',
      ],
    ],
  },
];
