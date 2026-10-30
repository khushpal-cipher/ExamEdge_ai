import { BUSINESS as B } from '@/lib/business';

// Draft texts from a standard template, written for what ExamEdge really does. A lawyer reviews Privacy, Terms and
// the consent screen after the first paying coachings (LAUNCH_PLAN item 20). Each doc: [heading, paragraphs[]].
type Doc = { title: string; description: string; sections: [string, string[]][] };

export const LEGAL_DOCS: Record<string, Doc> = {
  privacy: {
    title: 'Privacy Policy',
    description: 'What data ExamEdge AI collects, why, who processes it, and how long it is kept.',
    sections: [
      [
        'Who we are',
        [
          `${B.name} is run by ${B.legalName}, ${B.address}. A coaching institute that uses ${B.name} decides what student data goes in; we process it for them to provide the service.`,
        ],
      ],
      [
        'What we collect',
        [
          'Account data: name, email address and role (owner, admin, teacher or student) from Google sign-in or the invitation.',
          'Learning data: answers to tests and practice quizzes, marks, ranks, questions asked to the AI tutor and study material made for you, and notes uploaded by teachers.',
          'We do not run advertising, we do not track children, and we use only the cookies needed to keep you signed in.',
        ],
      ],
      [
        'Who processes it',
        [
          'Supabase (database and files), Vercel (website), Render (background jobs), Anthropic (AI answers), Resend (emails) and Google (sign-in). Some of these store data outside India.',
          'Your institute’s staff see your marks and progress. Staff never see the text of a student’s AI chats, only counts and topics, except an answer a student chooses to report.',
        ],
      ],
      [
        'How long we keep it',
        [
          'AI chats are deleted after 12 months. A deleted document’s files are removed after 30 days. When an institute ends, its data is deleted on request after 30 days.',
        ],
      ],
      [
        'Your rights and complaints',
        [
          `Ask your institute, or write to us, to see, correct or delete your data. Students under 18 need a parent’s consent. Grievance officer: ${B.grievanceOfficer}, ${B.grievanceEmail}.`,
        ],
      ],
    ],
  },
  terms: {
    title: 'Terms of Service',
    description: 'The rules for using ExamEdge AI: subscriptions, pilots, accounts and acceptable use.',
    sections: [
      [
        'The service',
        [
          `${B.name} is an online learning platform that coaching institutes subscribe to. A subscription covers one coaching institute: one account is for one person in one coaching.`,
        ],
      ],
      [
        'Pilots and prices',
        [
          'A free pilot lasts 7 days with limited students and AI use, then the institute becomes read-only until it subscribes. Prices are per active account per month, shown on our home page; GST is added when applicable.',
        ],
      ],
      [
        'Using the service',
        [
          'Do not share logins, upload material you have no right to, try to reach another institute’s data, or misuse the AI. We may suspend an account that does.',
          'AI answers can be wrong. Check important facts with your teacher. The institute owns the rights to the notes it uploads.',
        ],
      ],
      [
        'Ending',
        [
          'An institute can cancel any time and keeps access until the paid period ends. We may suspend service for non-payment or misuse.',
        ],
      ],
      ['Contact', [`${B.legalName}, ${B.address}. Email ${B.email}.`]],
    ],
  },
  refund: {
    title: 'Refund and Cancellation Policy',
    description: 'No refunds on payments; cancel any time and keep access until the paid period ends.',
    sections: [
      [
        'Cancellation',
        ['An institute can cancel at any time. Access continues until the end of the period already paid for.'],
      ],
      [
        'Refunds',
        [
          'Payments are not refundable: this covers monthly and yearly plans and AI top-up packs. If you were charged twice by mistake, write to us and we will return the extra payment.',
        ],
      ],
      ['Questions', [`Email ${B.email}.`]],
    ],
  },
  contact: {
    title: 'Contact Us',
    description: 'How to reach ExamEdge AI.',
    sections: [
      ['Write or call', [`${B.legalName}`, `Address: ${B.address}`, `Phone: ${B.phone}`, `Email: ${B.email}`]],
      ['Complaints', [`Grievance officer: ${B.grievanceOfficer}, ${B.grievanceEmail}.`]],
    ],
  },
  'service-delivery': {
    title: 'Service Delivery Policy',
    description: 'ExamEdge AI is an online service: nothing is shipped, access starts after payment is confirmed.',
    sections: [
      [
        'Online service',
        [
          'ExamEdge AI is delivered online. Nothing is shipped. A coaching’s access is switched on once its payment is confirmed, usually within one working day.',
        ],
      ],
    ],
  },
};
