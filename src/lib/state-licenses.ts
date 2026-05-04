/**
 * State Medical License Numbers
 * Maps US states to doctor's medical license numbers
 */

export const STATE_LICENSES: Record<string, string> = {
  Alabama: '50601',
  Arizona: '76271',
  California: 'A97833',
  Colorado: 'CDR.0004879',
  Connecticut: '77218',
  Delaware: 'C1-0027990',
  'District of Columbia': 'MD500003047',
  Florida: 'ME90639',
  Georgia: '103351',
  Hawaii: 'MD-25049-0',
  Idaho: 'M-17707',
  Illinois: '36.173637',
  Indiana: '01095765A',
  Iowa: 'MD-54357',
  Kansas: 'TW-00417',
  Kentucky: 'C3626',
  Louisiana: '345253',
  Maine: 'MD28009',
  Maryland: 'D0102626',
  Michigan: '4301511253',
  Minnesota: '3015',
  Mississippi: '34684',
  Missouri: '2025014599',
  Montana: '149930',
  Nebraska: 'CP1303',
  Nevada: '27070',
  'New Hampshire': '34364',
  'New Jersey': '25IA12537400',
  'New Mexico': 'TM2025-0105',
  'New York': '229551',
  'North Carolina': '2026-00243',
  'North Dakota': '22135',
  Ohio: '35C.002270',
  Oklahoma: '45149',
  Pennsylvania: 'MD488266C',
  'South Carolina': '96185',
  'South Dakota': '16942',
  Tennessee: '73567',
  Texas: 'V6158',
  Utah: '14202942-1235',
  Vermont: '42.0018404',
  Virginia: '0101285993',
  Washington: 'MD61657419',
  'West Virginia': '36273',
  Wisconsin: '13136-320',
  Wyoming: '18012C',
}

export interface StateLicenseInfo {
  stateName: string
  licenseNumber: string
}

/**
 * Get medical license information for a specific state
 * @param state - The US state name (e.g., "Texas", "California")
 * @returns License info object if state is found, null otherwise
 */
export function getStateLicense(state: string): StateLicenseInfo | null {
  const licenseNumber = STATE_LICENSES[state]

  if (!licenseNumber) {
    return null
  }

  return {
    stateName: state,
    licenseNumber,
  }
}
