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
]

export const NOTE_PURPOSES = {
  work: {
    label: 'Work',
    description: 'Share with your employer to excuse an absence or request accommodations.',
  },
  school: {
    label: 'School',
    description: 'Provide to your school administrator, counselor, or professor as needed.',
  },
  both: {
    label: 'Both Work & School',
    description: "Need coverage for both? We'll prepare a note suitable for either audience.",
  },
  other: {
    label: 'Other',
    description: 'Select this if the note is for travel, court, volunteer work, or another reason.',
  },
} as const

export const ABSENCE_REASONS = [
  'Feeling sick',
  'Accident or injury',
  'Mental health',
  'Taking care of someone',
  "Doctor's appointment",
  'Other',
] as const

// Symptoms organized by absence reason - each reason shows ~8 relevant symptoms
export const SYMPTOMS_BY_REASON: Record<string, string[]> = {
  'Feeling sick': [
    'Fever or chills',
    'Watery or itchy eyes',
    'Congestion or runny nose',
    'Cough or chest congestion',
    'Nausea or vomiting',
    'Menstrual cramps',
    'Fatigue',
    'Allergies',
    'Headache or migraine',
    'Earache',
    'Sore throat',
    'Abdominal pain',
    'Diarrhea or constipation',
    'Body or muscle aches',
    'Skin rash or burn',
    'COVID-19 or Flu',
    'Other',
  ],
  'Accident or injury': [
    'Fall',
    'Head injury or concussion',
    'Fracture or broken bone',
    'Sprain or strain',
    'Dislocation',
    'Cut or scrapes',
    'Minor burn',
    'Swelling or bruising',
    'Other',
  ],
  'Mental health': ['Anxiety', 'Sadness', 'Stress', 'Trouble sleeping', 'Irritability', 'Other'],
  'Taking care of someone': [
    'Parent',
    'Child',
    'Sibling',
    'Significant Other/Spouse',
    'Friend',
    'Other',
  ],
  "Doctor's appointment": [
    'Follow-up care needed',
    'Routine check-up',
    'Preventive screening',
    'Procedure scheduled',
    'Lab work required',
    'Specialist consultation',
  ],
  Other: [],
}

export const PROGRESS_VALUES: Record<number, number> = {
  1: 15,
  2: 30,
  3: 45,
  4: 55,
  5: 65,
  6: 72,
  7: 79,
  8: 85,
  9: 90,
  10: 94,
  11: 98,
}
