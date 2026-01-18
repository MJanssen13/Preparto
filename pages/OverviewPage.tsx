import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus } from '../types';
import { patientService } from '../services/supabaseService';
import { Search, Share2, BedDouble, Activity, Clock, Ruler, AlertCircle, Check, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';

const OverviewPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await patientService.getPatients();
    setPatients(data);
    setLoading(false);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const activePatients = patients.filter(p => 
    p.status !== PatientStatus.DISCHARGED &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.bed.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getNextTask = (p: Patient) => {
    return (p.schedule || [])
      .filter(t => t.status === 'pending')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
  };

  if (loading) {
      return <div className="p-12 text-center text-slate-400">Carregando painel...</div>;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-16 bg-slate-50 z-20 py-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral do Plantão</h1>
          <p className="text-slate-500 text-sm">Monitoramento consolidado de pacientes</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                type="text"
                placeholder="Filtrar paciente ou leito..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 shadow-sm"
                />
            </div>

            {/* Share Button */}
            <button 
                onClick={handleShare}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors active:scale-95"
            >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? 'Link Copiado!' : 'Compartilhar Painel'}
            </button>
        </div>
      </div>

      {/* Main Table/Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                        <th className="p-4 w-20 text-center">Leito</th>
                        <th className="p-4">Paciente / IG</th>
                        <th className="p-4">Obstétrico (Último)</th>
                        <th className="p-4">Vitas (Último)</th>
                        <th className="p-4">Próxima Aferição</th>
                        <th className="p-4 w-20"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {activePatients.length > 0 ? (
                        activePatients.map(patient => {
                            const lastObs = patient.lastObservation;
                            const nextTask = getNextTask(patient);
                            const hasAlert = patient.riskFactors && patient.riskFactors.length > 0;
                            
                            return (
                                <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors group">
                                    {/* Bed */}
                                    <td className="p-4 text-center">
                                        <div className="bg-medical-50 text-medical-700 font-bold text-xl rounded-lg py-2 border border-medical-100 inline-block w-12 text-center">
                                            {patient.bed}
                                        </div>
                                    </td>

                                    {/* Patient Info */}
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <Link to={`/patient/${patient.id}`} className="font-bold text-slate-900 text-base hover:text-medical-600 hover:underline">
                                                {patient.name}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 rounded border border-slate-200">
                                                    {patient.gestationalAgeWeeks}s+{patient.gestationalAgeDays}
                                                </span>
                                                <span className="text-xs text-slate-400">{patient.parity}</span>
                                            </div>
                                            {hasAlert && (
                                                <div className="mt-1 flex gap-1 flex-wrap">
                                                    {patient.riskFactors?.slice(0,2).map(rf => (
                                                        <span key={rf} className="text-[10px] text-red-600 bg-red-50 px-1 rounded border border-red-100 truncate max-w-[100px]">
                                                            {rf}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Obstetric Stats */}
                                    <td className="p-4">
                                        {lastObs ? (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Ruler className="w-4 h-4 text-slate-400" />
                                                    <span className="font-bold text-slate-700">
                                                        {lastObs.obstetric.dilation !== undefined ? `${lastObs.obstetric.dilation} cm` : '-'}
                                                    </span>
                                                    <span className="text-xs text-slate-400 ml-1">Dilatação</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Activity className="w-4 h-4 text-rose-400" />
                                                    <span className="font-bold text-slate-700">
                                                        {lastObs.obstetric.bcf !== undefined ? lastObs.obstetric.bcf : '-'}
                                                    </span>
                                                    <span className="text-xs text-slate-400 ml-1">bpm</span>
                                                </div>
                                                <div className="text-xs text-slate-500 pl-6">
                                                    Din: {lastObs.obstetric.dinamicaSummary || (lastObs.obstetric.dinamicaFrequency ? `${lastObs.obstetric.dinamicaFrequency}/10'` : '-')}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Sem dados</span>
                                        )}
                                    </td>

                                    {/* Vitals Stats */}
                                    <td className="p-4">
                                        {lastObs ? (
                                            <div className="space-y-1.5">
                                                {/* PA */}
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Activity className="w-4 h-4 text-indigo-400" />
                                                    <span className={`font-bold ${
                                                        (lastObs.vitals.paSystolic || 0) >= 140 ? 'text-red-600' : 'text-slate-700'
                                                    }`}>
                                                        {lastObs.vitals.paSystolic !== undefined ? `${lastObs.vitals.paSystolic}x${lastObs.vitals.paDiastolic}` : '-'}
                                                    </span>
                                                    <span className="text-xs text-slate-400 ml-1">mmHg</span>
                                                </div>
                                                
                                                {/* MgSO4 Data (if applicable) */}
                                                {patient.useMagnesiumSulfate && lastObs.magnesiumData && (
                                                     <div className="bg-purple-50 text-purple-800 text-xs px-2 py-1 rounded border border-purple-100 inline-block">
                                                        Reflexo: {lastObs.magnesiumData.reflex} | Diurese: {lastObs.magnesiumData.diuresis}
                                                     </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Sem dados</span>
                                        )}
                                    </td>

                                    {/* Schedule */}
                                    <td className="p-4">
                                        {nextTask ? (
                                            <div className="flex items-start gap-2">
                                                <div className={`p-1.5 rounded-lg ${
                                                    new Date(nextTask.timestamp).getTime() < new Date().getTime() 
                                                    ? 'bg-red-100 text-red-600 animate-pulse' 
                                                    : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                    <Clock className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        {new Date(nextTask.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {nextTask.focus.map(f => (
                                                            <span key={f} className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1 rounded border border-slate-200">
                                                                {f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-xs text-green-600 font-medium opacity-50">
                                                <Check className="w-3 h-3" /> Sem pendências
                                            </div>
                                        )}
                                    </td>

                                    {/* Action */}
                                    <td className="p-4 text-right">
                                        <Link 
                                            to={`/patient/${patient.id}`}
                                            className="text-medical-600 hover:text-medical-700 font-bold text-sm bg-white border border-medical-200 hover:bg-medical-50 px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"
                                        >
                                            Detalhes
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                Nenhum paciente encontrado com estes filtros.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
            <span>Mostrando {activePatients.length} pacientes ativos</span>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-red-500"></div> PA Elevada
               <div className="w-2 h-2 rounded-full bg-red-100 ml-2"></div> Atrasado
            </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;