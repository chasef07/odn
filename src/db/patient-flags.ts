import { db } from './pool'
import { sql } from './sql'
import { insert, selectAll, set } from './table'
import { patientFlags } from './tables'
import { patientIdentityWhere, type PatientIdentity } from './submissions'
import type { PatientFlag } from './types'

export async function findPatientFlag(identity: PatientIdentity): Promise<PatientFlag | null> {
  return db.one(
    sql`SELECT ${selectAll(patientFlags)} FROM patient_flags WHERE ${patientIdentityWhere(identity)}`
  )
}

export async function flagPatient(
  identity: PatientIdentity,
  { reason, flaggedBy, flaggedAt }: Pick<PatientFlag, 'reason' | 'flaggedBy' | 'flaggedAt'>
): Promise<PatientFlag> {
  const flag = await db.one(
    sql`${insert(patientFlags, { ...identity, reason, flaggedBy, flaggedAt })} ON CONFLICT (lower(patient_first_name), lower(patient_last_name), patient_date_of_birth) DO UPDATE SET ${set(patientFlags, { reason })} RETURNING ${selectAll(patientFlags)}`
  )
  if (!flag) throw new Error('Flagging the patient returned no row')
  return flag
}

export async function unflagPatient(identity: PatientIdentity): Promise<number> {
  return db.affected(sql`DELETE FROM patient_flags WHERE ${patientIdentityWhere(identity)}`)
}
