
import React from 'react';
import { Patient, PatientStatus } from '../types';
import { get24hStats } from '../services/supabaseService';
import { Clock, Activity, Ruler, BedDouble, CheckCircle2, Archive, ArrowDownUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PatientCardProps {
  patient: Patient;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient }) => {
  const lastObs = patient.lastObservation;
  const isDischarged = patient.status === PatientStatus.DISCHARGED;
  const isPartogram = patient.status === PatientStatus.PARTOGRAM_OPENED;
  const isResolved = isDischarged || isPartogram;

  // Calculate 24h stats for PA and BCF ranges
  const stats = get24hStats(patient.observations);

  // --- LAST KNOWN VALUES LOGIC ---
  // We search history because the VERY last observation might be just a BP check, 
  // but we still want to see the last Dilation/Dynamics measured 2 hours ago.
  const history = patient.observations || [];
  // (History is sorted desc in service, but let's be safe)
  
  const lastDilationObs = history.find(o => 
      o.obstetric.dilation !== undefined || 
      (o.obstetric.cervixStatus && o.obstetric.cervixStatus.length > 0)
  );

  const lastDynamicsObs = history.find(o => 
      o.obstetric.dinamicaSummary || 
      o.obstetric.dinamicaFrequency !== undefined
  );

  // Find next pending task
  const nextTask = (patient.schedule || [])
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

  // Helper to check BCF abnormality
  const isBcfAbnormal = lastObs?.obstetric.bcf !== undefined && (lastObs.obstetric.bcf < 110 || lastObs.obstetric.bcf > 160);

  // Border and Background styling based on status
  let cardStyle = "border-slate-200 bg-white";
  let bedBadgeStyle = "bg-medical-50 text-medical-700 border-medical-100";

  if (isDischarged) {
      cardStyle = "border-slate-200 bg-slate-50 opacity-80";
      bedBadgeStyle = "bg-slate-100 text-slate-500 border-slate-200";
  } else if (isPartogram) {
      cardStyle = "border-green-200 bg-green-50/30";
      bedBadgeStyle = "bg-green-100 text-green-700 border-green-200";
  }

  return (
    <Link to={`/patient/${patient.id}`} className="block">
      <div className={`rounded-xl shadow-sm border p-4 active:scale-[0.98] transition-transform duration-150 relative overflow-hidden ${cardStyle}`}>
        
        {/* Bed Badge */}
        <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-xl text-lg font-bold border-l border-b flex items-center gap-2 ${bedBadgeStyle}`}>
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
          
          {/* Dynamics - Last Known */}
          <div className="bg-white/60 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
              <Activity className="w-3 h-3" />
              <span>Dinâm</span>
            </div>
            <span className="font-bold text-slate-700 text-sm text-center leading-tight">
              {lastDynamicsObs 
                ? (lastDynamicsObs.obstetric.dinamicaSummary || `${lastDynamicsObs.obstetric.dinamicaFrequency}/10'`)
                : '-'
              }
            </span>
          </div>

          {/* BCF - 24h Range */}
          <div className="bg-white/60 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
              <Activity className={`w-3 h-3 ${isBcfAbnormal ? 'text-red-500' : 'text-rose-500'}`} />
              <span>BCF (24h)</span>
            </div>
            <span className={`font-bold ${isBcfAbnormal ? 'text-red-600' : 'text-slate-700'}`}>
              {stats?.hasBcf ? stats.bcf : (lastObs?.obstetric.bcf || '-')}
            </span>
          </div>

          {/* Dilation - Last Known */}
          <div className="bg-white/60 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
              <Ruler className="w-3 h-3" />
              <span>Dilat</span>
            </div>
            <span className="font-bold text-slate-700">
              {lastDilationObs 
                 ? (lastDilationObs.obstetric.dilation !== undefined ? `${lastDilationObs.obstetric.dilation} cm` : (lastDilationObs.obstetric.cervixStatus?.join(' '))) 
                 : '-'}
            </span>
          </div>
        </div>
        
        {/* Additional 24h PA Row */}
        {stats?.hasPa && (
            <div className="mt-2 bg-slate-50/80 px-2 py-1.5 rounded-lg border border-slate-100 flex items-center justify-center gap-2 text-xs">
                <span className="font-bold text-slate-500 uppercase text-[10px]">PA (24h):</span>
                <span className="font-mono text-slate-700 font-bold">{stats.pas} x {stats.pad}</span>
            </div>
        )}

        {/* Footer Info / Resolution Status */}
        <div className="mt-3 flex items-center justify-between text-xs">
          {isResolved ? (
             <div className="flex flex-col w-full gap-1">
                 <div className={`flex items-center gap-1 font-bold ${isPartogram ? 'text-green-600' : 'text-slate-500'}`}>
                     {isPartogram ? <CheckCircle2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                     <span>{isPartogram ? 'EM PARTOGRAMA' : 'ALTA / TRANSFERÊNCIA'}</span>
                 </div>
                 {patient.dischargeTime && (
                     <div className="text-slate-400 text-[10px]">
                        Resolvido em: {new Date(patient.dischargeTime).toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
                     </div>
                 )}
             </div>
          ) : nextTask ? (
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
