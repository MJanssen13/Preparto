import React from 'react';
import { Patient, PatientStatus } from '../types';
import { Clock, Activity, Ruler, BedDouble } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PatientCardProps {
  patient: Patient;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient }) => {
  const lastObs = patient.lastObservation;
  const isDischarged = patient.status === PatientStatus.DISCHARGED;

  // Find next pending task
  const nextTask = (patient.schedule || [])
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

  return (
    <Link to={`/patient/${patient.id}`} className="block">
      <div className={`bg-white rounded-xl shadow-sm border p-4 active:scale-[0.98] transition-transform duration-150 relative overflow-hidden ${isDischarged ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
        
        {/* Bed Badge */}
        <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-xl text-lg font-bold border-l border-b flex items-center gap-2 ${isDischarged ? 'bg-slate-100 text-slate-500' : 'bg-medical-50 text-medical-700 border-medical-100'}`}>
          <BedDouble className="w-5 h-5" />
          {patient.bed}
        </div>

        <div className="mb-3 pr-20">
          <h3 className="text-lg font-bold text-slate-900 truncate">{patient.name}</h3>
          <p className="text-sm text-slate-500">
             G{patient.gestationalAgeWeeks}+{patient.gestationalAgeDays} • {patient.parity}
          </p>
        </div>

        {/* Quick Vitals Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-slate-50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
              <Activity className="w-3 h-3" />
              <span>Dinâm</span>
            </div>
            <span className="font-bold text-slate-700">
              {lastObs && lastObs.obstetric.dinamicaFrequency !== undefined ? `${lastObs.obstetric.dinamicaFrequency}/10'` : '-'}
            </span>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
              <Activity className="w-3 h-3 text-rose-500" />
              <span>BCF</span>
            </div>
            <span className="font-bold text-slate-700">
              {lastObs && lastObs.obstetric.bcf !== undefined ? lastObs.obstetric.bcf : '-'}
            </span>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
              <Ruler className="w-3 h-3" />
              <span>Dilat</span>
            </div>
            <span className="font-bold text-slate-700">
              {lastObs && lastObs.obstetric.dilation !== undefined ? `${lastObs.obstetric.dilation} cm` : '-'}
            </span>
          </div>
        </div>

        {/* Footer Info / Next Action */}
        <div className="mt-3 flex items-center justify-between text-xs">
          {nextTask && !isDischarged ? (
             <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded">
               <Clock className="w-3 h-3" />
               <span className="font-bold">
                 Próx: {new Date(nextTask.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </span>
               <span className="text-blue-400 mx-1">|</span>
               <span>
                  {nextTask.focus?.join(', ') || 'Avaliar'}
               </span>
             </div>
          ) : (
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3" />
              <span>
                Última: {lastObs 
                  ? new Date(lastObs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                  : '-'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default PatientCard;