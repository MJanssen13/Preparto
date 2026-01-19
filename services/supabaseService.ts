

import { Patient, Observation, PatientStatus } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  return (process as any).env?.[key];
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://itpdwlpraogwsdezsotl.supabase.co'; 
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_w6fGM5XImiuAtOt-baidAQ_dzLurOtK';

const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

const STORAGE_KEY_PATIENTS = 'maternocare_patients';
const STORAGE_KEY_OBSERVATIONS = 'maternocare_observations';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isPatientExpired = (p: Patient): boolean => {
  // Check if patient is resolved (Discharged or Partogram Opened) and has a discharge time
  const isResolved = p.status === PatientStatus.DISCHARGED || p.status === PatientStatus.PARTOGRAM_OPENED;
  
  if (!isResolved || !p.dischargeTime) return false;
  
  const dischargeDate = new Date(p.dischargeTime).getTime();
  const now = new Date().getTime();
  const hoursSinceDischarge = (now - dischargeDate) / (1000 * 60 * 60);
  return hoursSinceDischarge >= 72;
};

const mapPatientToDB = (p: Partial<Patient>) => {
  return {
    ...(p.name && { name: p.name }),
    ...(p.bed && { bed: p.bed }),
    ...(p.age && { age: p.age }),
    ...(p.gestationalAgeWeeks && { gestational_age_weeks: p.gestationalAgeWeeks }),
    ...(p.gestationalAgeDays && { gestational_age_days: p.gestationalAgeDays }),
    ...(p.parity && { parity: p.parity }),
    ...(p.admissionDate && { admission_date: p.admissionDate }),
    ...(p.status && { status: p.status }),
    ...(p.bloodType && { blood_type: p.bloodType }),
    ...(p.riskFactors && { risk_factors: p.riskFactors }),
    ...(p.useMethyldopa !== undefined && { use_methyldopa: p.useMethyldopa }),
    ...(p.useMagnesiumSulfate !== undefined && { use_magnesium_sulfate: p.useMagnesiumSulfate }),
    ...(p.dischargeTime && { discharge_time: p.dischargeTime }),
    ...(p.schedule && { schedule: p.schedule }),
    ...(p.lastObservation && { last_observation: p.lastObservation })
  };
};

const mapPatientFromDB = (db: any): Patient => {
  return {
    id: db.id,
    name: db.name,
    bed: db.bed,
    age: db.age,
    gestationalAgeWeeks: db.gestational_age_weeks,
    gestationalAgeDays: db.gestational_age_days,
    parity: db.parity,
    admissionDate: db.admission_date,
    status: db.status,
    bloodType: db.blood_type,
    riskFactors: db.risk_factors,
    useMethyldopa: db.use_methyldopa,
    useMagnesiumSulfate: db.use_magnesium_sulfate,
    dischargeTime: db.discharge_time,
    schedule: db.schedule || [],
    lastObservation: db.last_observation
  };
};

const mapObservationToDB = (o: Partial<Observation>) => {
    return {
        ...(o.patientId && { patient_id: o.patientId }),
        ...(o.timestamp && { timestamp: o.timestamp }),
        ...(o.vitals && { vitals: o.vitals }),
        ...(o.obstetric && { obstetric: o.obstetric }),
        ...(o.medication && { medication: o.medication }),
        ...(o.magnesiumData && { magnesium_data: o.magnesiumData }),
        ...(o.examinerName && { examiner_name: o.examinerName }),
        ...(o.notes && { notes: o.notes }),
    }
}

const mapObservationFromDB = (db: any): Observation => {
    return {
        id: db.id,
        patientId: db.patient_id,
        timestamp: db.timestamp,
        vitals: db.vitals,
        obstetric: db.obstetric,
        medication: db.medication,
        magnesiumData: db.magnesium_data,
        examinerName: db.examiner_name,
        notes: db.notes
    }
}

export const patientService = {
  async getPatients(): Promise<Patient[]> {
    if (!supabase) {
        const data = localStorage.getItem(STORAGE_KEY_PATIENTS);
        let patients: Patient[] = data ? JSON.parse(data) : [];
        patients = patients.filter(p => !isPatientExpired(p));
        return patients.sort((a, b) => {
            // Sort resolved patients to the bottom
            const aResolved = a.status === PatientStatus.DISCHARGED || a.status === PatientStatus.PARTOGRAM_OPENED;
            const bResolved = b.status === PatientStatus.DISCHARGED || b.status === PatientStatus.PARTOGRAM_OPENED;
            
            if (aResolved && !bResolved) return 1;
            if (bResolved && !aResolved) return -1;
            
            return a.bed.localeCompare(b.bed, undefined, { numeric: true });
        });
    }
    const { data, error } = await supabase.from('patients').select('*').order('bed', { ascending: true });
    if (error) return [];
    const patients = data.map(mapPatientFromDB);
    return patients.filter(p => !isPatientExpired(p));
  },

  async getPatientById(id: string): Promise<Patient | undefined> {
    if (!supabase) {
        const patients = await this.getPatients();
        return patients.find(p => p.id === id);
    }
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
    if (error || !data) return undefined;
    return mapPatientFromDB(data);
  },

  async createPatient(patientData: Omit<Patient, 'id' | 'lastObservation'>): Promise<Patient> {
    if (!supabase) {
        const patients = await this.getPatients();
        const newPatient: Patient = { ...patientData, id: crypto.randomUUID() };
        patients.push(newPatient);
        localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
        return newPatient;
    }
    const dbPayload = mapPatientToDB(patientData);
    const { data, error } = await supabase.from('patients').insert(dbPayload).select().single();
    if (error) throw error;
    return mapPatientFromDB(data);
  },

  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    if (!supabase) {
        const patients = await this.getPatients();
        const index = patients.findIndex(p => p.id === id);
        if (index === -1) return null;
        patients[index] = { ...patients[index], ...updates };
        localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
        return patients[index];
    }
    const dbPayload = mapPatientToDB(updates);
    const { data, error } = await supabase.from('patients').update(dbPayload).eq('id', id).select().single();
    if (error) return null;
    return mapPatientFromDB(data);
  },

  async deletePatient(id: string): Promise<void> {
    if (!supabase) {
        // Local Storage: Delete patient and observations
        const patientsStr = localStorage.getItem(STORAGE_KEY_PATIENTS);
        if (patientsStr) {
            const patients = JSON.parse(patientsStr);
            const newPatients = patients.filter((p: Patient) => p.id !== id);
            localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(newPatients));
        }

        const obsStr = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        if (obsStr) {
            const obs = JSON.parse(obsStr);
            const newObs = obs.filter((o: Observation) => o.patientId !== id);
            localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(newObs));
        }
        return;
    }

    // Supabase: Delete observations first to satisfy FK constraints (if cascade not set)
    const { error: obsError } = await supabase.from('observations').delete().eq('patient_id', id);
    if (obsError) throw obsError;

    // Delete patient
    const { error: patError } = await supabase.from('patients').delete().eq('id', id);
    if (patError) throw patError;
  },

  async getObservations(patientId: string): Promise<Observation[]> {
    if (!supabase) {
        const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        const allObs: Observation[] = data ? JSON.parse(data) : [];
        return allObs
          .filter(o => o.patientId === patientId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    const { data, error } = await supabase.from('observations').select('*').eq('patient_id', patientId).order('timestamp', { ascending: false });
    if (error) return [];
    return data.map(mapObservationFromDB);
  },

  async getObservationById(id: string): Promise<Observation | undefined> {
      if (!supabase) {
          const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
          const allObs: Observation[] = data ? JSON.parse(data) : [];
          return allObs.find(o => o.id === id);
      }
      const { data, error } = await supabase.from('observations').select('*').eq('id', id).single();
      if (error || !data) return undefined;
      return mapObservationFromDB(data);
  },

  async updateObservation(id: string, updates: Partial<Observation>): Promise<Observation | null> {
      if (!supabase) {
          const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
          const allObs: Observation[] = data ? JSON.parse(data) : [];
          const index = allObs.findIndex(o => o.id === id);
          if (index === -1) return null;
          const updatedObs = { ...allObs[index], ...updates };
          allObs[index] = updatedObs;
          localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(allObs));
          return updatedObs;
      }
      const dbPayload = mapObservationToDB(updates);
      const { data, error } = await supabase.from('observations').update(dbPayload).eq('id', id).select().single();
      if (error) return null;
      return mapObservationFromDB(data);
  },

  async addObservation(obsData: Omit<Observation, 'id' | 'timestamp'> & { timestamp?: string }, scheduledTaskId?: string): Promise<Observation> {
    if (!supabase) {
        const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        const allObs: Observation[] = data ? JSON.parse(data) : [];
        const timestamp = obsData.timestamp || new Date().toISOString();
        const newObs: Observation = { ...obsData, id: crypto.randomUUID(), timestamp };
        allObs.push(newObs);
        localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(allObs));
        
        const patients = await this.getPatients();
        const patientIndex = patients.findIndex(p => p.id === obsData.patientId);
        if (patientIndex >= 0) {
            patients[patientIndex].lastObservation = newObs;
            if (scheduledTaskId) {
                patients[patientIndex].schedule = patients[patientIndex].schedule.map(t => 
                    t.id === scheduledTaskId ? { ...t, status: 'completed' } : t
                );
            }
            localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
        }
        return newObs;
    }
    const timestamp = obsData.timestamp || new Date().toISOString();
    const dbPayload = mapObservationToDB({ ...obsData, timestamp });
    const { data, error } = await supabase.from('observations').insert(dbPayload).select().single();
    if (error) throw error;
    const newObs = mapObservationFromDB(data);
    
    if (scheduledTaskId) {
        const patient = await this.getPatientById(newObs.patientId);
        if (patient) {
            const updatedSchedule = patient.schedule.map(task => 
                task.id === scheduledTaskId ? { ...task, status: 'completed' as const } : task
            );
            await this.updatePatient(patient.id, { schedule: updatedSchedule, lastObservation: newObs });
        }
    }
    return newObs;
  }
};