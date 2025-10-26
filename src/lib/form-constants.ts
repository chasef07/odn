/**
 * Form Constants
 * All dropdown options, labels, and static data
 */

export const AVAILABLE_STATES = [
  'Alabama',
  'Arizona',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Pennsylvania',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
];

export const RELATIONSHIPS = [
  'Parent',
  'Child',
  'Sibling',
  'Other family member',
  'Spouse/Significant Other',
  'Friend',
];

export const NOTE_PURPOSES = {
  work: {
    label: 'Work',
    description:
      'Share with your employer to excuse an absence or request accommodations.',
  },
  school: {
    label: 'School',
    description:
      'Provide to your school administrator, counselor, or professor as needed.',
  },
  both: {
    label: 'Work & School',
    description:
      "Need coverage for both? We'll prepare a note suitable for either audience.",
  },
  other: {
    label: 'Other',
    description:
      'Select this if the note is for travel, court, volunteer work, or another reason.',
  },
} as const;

export const ABSENCE_REASONS = [
  'Common cold or flu',
  'Stomach bug',
  'Sore or strep throat',
  'COVID-19',
  'Headache or migraine',
  'Mental health condition',
  'Injury',
  'Medical appointment',
  'Other',
] as const;

// Symptoms organized by absence reason - each reason shows ~8 relevant symptoms
export const SYMPTOMS_BY_REASON: Record<string, string[]> = {
  'Common cold or flu': [
    'Fever or chills',
    'Cough',
    'Congestion or runny nose',
    'Sore throat',
    'Fatigue',
    'Body aches',
    'Headache',
    'Loss of smell or taste',
  ],
  'Stomach bug': [
    'Nausea or vomiting',
    'Diarrhea',
    'Abdominal pain or cramps',
    'Fever',
    'Fatigue',
    'Loss of appetite',
    'Dehydration',
    'Body aches',
  ],
  'Sore or strep throat': [
    'Sore throat',
    'Difficulty swallowing',
    'Fever',
    'Swollen glands',
    'Headache',
    'Fatigue',
    'Body aches',
  ],
  'COVID-19': [
    'Fever or chills',
    'Cough',
    'Shortness of breath',
    'Loss of smell or taste',
    'Fatigue',
    'Body aches',
    'Headache',
    'Congestion or runny nose',
  ],
  'Headache or migraine': [
    'Severe headache',
    'Sensitivity to light',
    'Sensitivity to sound',
    'Nausea or vomiting',
    'Dizziness',
    'Fatigue',
    'Vision changes',
    'Difficulty concentrating',
  ],
  'Mental health condition': [
    'Anxiety',
    'Depression',
    'Stress or burnout',
    'Sleep disturbance',
    'Difficulty concentrating',
    'Fatigue',
    'Changes in appetite',
    'Social withdrawal',
  ],
  'Injury': [
    'Pain (at injury site)',
    'Swelling or inflammation',
    'Limited mobility',
    'Bruising',
    'Stiffness',
    'Difficulty walking/moving',
    'Numbness or tingling',
    'Visible wound',
  ],
  'Medical appointment': [
    'Follow-up care needed',
    'Routine check-up',
    'Preventive screening',
    'Procedure scheduled',
    'Lab work required',
    'Specialist consultation',
  ],
  'Taking care of family': [
    'Family member is ill',
    'Family member injured',
    'Family member has appointment',
    'Childcare needed',
    'Elder care needed',
    'Post-surgery care',
    'Emergency situation',
  ],
};

export const PROGRESS_VALUES: Record<number, number> = {
  1: 15,
  2: 30,
  3: 45,
  4: 55,
  5: 65,
  6: 75,
  7: 85,
  8: 92,
  9: 98,
};
