

import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus, Observation } from '../types';
import { patientService } from '../services/supabaseService';
import { Search, Share2, Activity, Clock, Ruler, Check, ChevronDown, ChevronUp, Copy, Clipboard, FileText, Filter, BedDouble, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VitalCharts } from '../components/VitalCharts';

const OverviewPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  
  // State for expanding rows
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [expandedObservations, setExpandedObservations] = useState<Observation[]>([]);
  const [loadingObs, setLoadingObs] = useState(false);

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

  const toggleExpand = async (patientId: string) => {
      if (expandedPatientId === patientId) {
          setExpandedPatientId(null);
          setExpandedObservations([]);
          return;
      }

      setExpandedPatientId(patientId);
      setLoadingObs(true);
      const obs = await patientService.getObservations(patientId);
      setExpandedObservations(obs);
      setLoadingObs(false);
  };

  const activePatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.bed.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status Logic
    const isResolved = p.status === PatientStatus.DISCHARGED || p.status === PatientStatus.PARTOGRAM_OPENED;
    
    if (showResolved) {
        return matchesSearch; // Show everything if resolved is toggled on
    }
    return matchesSearch && !isResolved; // Otherwise only show active
  });

  const getNextTask = (p: Patient) => {
    return (p.schedule || [])
      .filter(t => t.status === 'pending')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
  };

  // --- Logic for Prontuário Text Generation ---
  const formatToqueVaginal = (o: Observation['obstetric']) => {
      const parts = [];

      // Apagamento: G or % AP
      if (o.effacement !== undefined) {
          parts.push(o.effacement === 0 ? 'G' : `${o.effacement}% AP`);
      }

      // Posição: P, I, C
      const posMap: Record<string, string> = { 'Posterior': 'P', 'Intermediário': 'I', 'Central': 'C' };
      if (o.cervixPosition && posMap[o.cervixPosition]) parts.push(posMap[o.cervixPosition]);

      // Consistência: N, NL, L
      const conMap: Record<string, string> = { 'Nasal': 'N', 'Nasolabial': 'NL', 'Labial': 'L' };
      if (o.cervixConsistency && conMap[o.cervixConsistency]) parts.push(conMap[o.cervixConsistency]);

      // Dilatação / Status
      if (o.dilation !== undefined && o.dilation > 0) {
          parts.push(`${o.dilation}CM`);
      } else if (o.cervixStatus && o.cervixStatus.length > 0) {
          // Join status like OEEA, OII
          parts.push(o.cervixStatus.join(', '));
      } else if (o.dilation === 0) {
          parts.push('0CM');
      }

      // Altura da Apresentação
      if (o.presentationHeight) {
          parts.push(o.presentationHeight);
      }

      // Sangue
      if (o.bloodOnGlove !== undefined) {
          parts.push(o.bloodOnGlove ? 'SDL' : 'SSDL');
      }

      return parts.length > 0 ? `TOQUE: ${parts.join(', ')}` : '';
  };

  const generateProntuarioText = (patient: Patient, obsList: Observation[]) => {
      // Sort Chronologically: Oldest -> Newest
      const sorted = [...obsList].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let text = '';
      let lastDate = '';

      sorted.forEach(o => {
          const dateObj = new Date(o.timestamp);
          
          // Format Date Header: # DD/MM/YY #
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = String(dateObj.getFullYear()).slice(-2);
          const dateStr = `${day}/${month}/${year}`;

          if (dateStr !== lastDate) {
              text += `# ${dateStr} #\n`;
              lastDate = dateStr;
          }

          const time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const lineParts = [`${time} HS`];
          
          // BCF
          if (o.obstetric.bcf) lineParts.push(`BCF: ${o.obstetric.bcf} BPM`);
          
          // PA
          if (o.vitals.paSystolic) lineParts.push(`PA: ${o.vitals.paSystolic}X${o.vitals.paDiastolic} MMHG`);

          // Dynamics (DU)
          if (o.obstetric.dinamicaSummary) {
              // Ensure consistent UPPERCASE for "Ausente", "Presente", etc.
              lineParts.push(`DU ${o.obstetric.dinamicaSummary.toUpperCase()}`);
          } else if (o.obstetric.dinamicaFrequency) {
              lineParts.push(`DU ${o.obstetric.dinamicaFrequency}/10'`);
          }
          
          // Toque
          const toqueStr = formatToqueVaginal(o.obstetric);
          if (toqueStr) lineParts.push(toqueStr);

          // Meds (Custom formatting based on example)
          if (o.medication?.misoprostolDose) lineParts.push(`MISOPROSTOL ${o.medication.misoprostolDose}MCG`);
          if (o.medication?.oxytocinDose) lineParts.push(`OCITOCINA ${o.medication.oxytocinDose} ML/H`);

          // Mag Protocol
          if (o.magnesiumData) {
              if (o.magnesiumData.diuresis) lineParts.push(`DIURESE ${o.magnesiumData.diuresis}`);
              if (o.magnesiumData.reflex) lineParts.push(`REFLEXO ${o.magnesiumData.reflex.toUpperCase()}`);
          }

          // Notes
          if (o.notes) lineParts.push(o.notes.toUpperCase());

          // Join with pipe separator
          text += lineParts.join(' | ') + '\n';
      });

      // Special Footer for Partogram Opened
      if (patient.status === PatientStatus.PARTOGRAM_OPENED) {
          text += "\nABERTO PARTOGRAMA E MANTIDO DEMAIS PARÂMETROS REGISTRADOS EM PARTOGRAMA.";
      }

      return text;
  };

  const copyProntuarioToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert('Texto copiado para a área de transferência!');
  };

  if (loading) {
      return <div className="p-12 text-center text-slate-400">Carregando painel...</div>;
  }

  // Helper component for expanded content (Shared between Mobile and Desktop)
  const ExpandedContent = ({ patient, observations, isLoading }: { patient: Patient, observations: Observation[], isLoading: boolean }) => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
          
          {/* 1. Charts Column */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Gráficos de Tendência
              </h4>
              {isLoading ? (
                  <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>
              ) : (
                  <div className="h-64 overflow-y-auto custom-scrollbar">
                      <VitalCharts observations={observations} />
                  </div>
              )}
          </div>

          {/* 2. History List Column */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Clipboard className="w-4 h-4" /> Histórico Recente
              </h4>
              <div className="flex-1 overflow-y-auto max-h-64 custom-scrollbar">
                  {isLoading ? (
                      <div className="text-center py-8 text-slate-400">...</div>
                  ) : observations.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 italic text-sm">Sem registros.</div>
                  ) : (
                      <table className="w-full text-xs">
                          <thead className="bg-slate-50 text-slate-500 sticky top-0">
                              <tr>
                                  <th className="p-2 text-left">Hora</th>
                                  <th className="p-2 text-left">BCF</th>
                                  <th className="p-2 text-left">PA</th>
                                  <th className="p-2 text-left">Dilat</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {observations.slice(0, 10).map(obs => (
                                  <tr key={obs.id}>
                                      <td className="p-2 font-bold text-slate-700">
                                          {new Date(obs.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                      </td>
                                      <td className={`p-2 ${
                                          obs.obstetric.bcf !== undefined && (obs.obstetric.bcf < 110 || obs.obstetric.bcf > 160)
                                          ? 'text-red-600 font-bold'
                                          : ''
                                      }`}>
                                          {obs.obstetric.bcf || '-'}
                                      </td>
                                      <td className="p-2">{obs.vitals.paSystolic ? `${obs.vitals.paSystolic}x${obs.vitals.paDiastolic}` : '-'}</td>
                                      <td className="p-2">{obs.obstetric.dilation ? `${obs.obstetric.dilation}cm` : (obs.obstetric.cervixStatus && obs.obstetric.cervixStatus.length > 0 ? obs.obstetric.cervixStatus[0] : '-')}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          </div>

          {/* 3. Medical Record Text Generator Column */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Copiar para Prontuário
                  </h4>
                  <button 
                      onClick={() => copyProntuarioToClipboard(generateProntuarioText(patient, observations))}
                      className="text-xs bg-medical-50 text-medical-700 hover:bg-medical-100 px-2 py-1 rounded border border-medical-200 flex items-center gap-1 transition-colors"
                  >
                      <Copy className="w-3 h-3" /> Copiar Texto
                  </button>
              </div>
              <div className="flex-1">
                  {isLoading ? (
                      <div className="h-full bg-slate-50 rounded animate-pulse"></div>
                  ) : (
                      <textarea 
                          readOnly
                          className="w-full h-64 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
                          value={generateProntuarioText(patient, observations)}
                      />
                  )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                  Formato: Cronológico (Antigo &rarr; Novo). Copie e cole no sistema.
              </p>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-16 bg-slate-50 z-20 py-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral do Plantão</h1>
          <p className="text-slate-500 text-sm">Monitoramento consolidado e evolução</p>
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

            {/* Resolved Toggle */}
            <button 
                onClick={() => setShowResolved(!showResolved)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition-colors border ${showResolved ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
            >
                <Filter className="w-3 h-3" />
                <span>{showResolved ? 'Ocultar Resolvidos' : 'Mostrar Resolvidos'}</span>
            </button>

            {/* Share Button */}
            <button 
                onClick={handleShare}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors active:scale-95"
            >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Link Copiado!' : 'Compartilhar'}</span>
            </button>
        </div>
      </div>

      {/* MOBILE VIEW (CARDS) */}
      <div className="md:hidden space-y-4">
        {activePatients.length > 0 ? (
          activePatients.map(patient => {
            const lastObs = patient.lastObservation;
            const nextTask = getNextTask(patient);
            const isExpanded = expandedPatientId === patient.id;
            const isResolved = patient.status === PatientStatus.DISCHARGED || patient.status === PatientStatus.PARTOGRAM_OPENED;
            const isBcfAbnormal = lastObs?.obstetric.bcf !== undefined && (lastObs.obstetric.bcf < 110 || lastObs.obstetric.bcf > 160);

            return (
              <div 
                key={patient.id} 
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isExpanded ? 'border-medical-200 ring-2 ring-medical-100' : 'border-slate-200'} ${isResolved ? 'opacity-75 bg-slate-50' : ''}`}
              >
                {/* Card Header (Clickable to Expand) */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50"
                  onClick={() => toggleExpand(patient.id)}
                >
                   <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border font-bold text-lg ${isResolved ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-medical-50 text-medical-700 border-medical-100'}`}>
                         <span className="text-[8px] uppercase font-normal opacity-70">Leito</span>
                         {patient.bed}
                      </div>
                      <div>
                         <h3 className="font-bold text-slate-800">{patient.name}</h3>
                         <div className="flex items-center gap-2 text-xs text-slate-500">
                             <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {patient.gestationalAgeWeeks}s+{patient.gestationalAgeDays}
                             </span>
                             <span>{patient.parity}</span>
                             {isResolved && (
                                <span className="bg-slate-600 text-white px-1.5 py-0.5 rounded font-bold">
                                   {patient.status === PatientStatus.PARTOGRAM_OPENED ? 'PARTOGRAMA' : 'ALTA'}
                                </span>
                             )}
                         </div>
                      </div>
                   </div>
                   <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                   </div>
                </div>

                {/* Card Body (Last Obs Summary) */}
                {!isExpanded && (
                   <div className="px-4 pb-4 grid grid-cols-3 gap-2 text-xs" onClick={() => toggleExpand(patient.id)}>
                      <div className="bg-rose-50 p-2 rounded border border-rose-100 flex flex-col items-center justify-center text-center">
                         <span className="text-[10px] text-rose-400 font-bold uppercase mb-0.5">BCF</span>
                         <span className={`font-bold text-sm ${isBcfAbnormal ? 'text-red-600' : 'text-slate-700'}`}>
                           {lastObs?.obstetric.bcf || '-'}
                         </span>
                      </div>
                      <div className="bg-blue-50 p-2 rounded border border-blue-100 flex flex-col items-center justify-center text-center">
                         <span className="text-[10px] text-blue-400 font-bold uppercase mb-0.5">Dilat</span>
                         <span className="font-bold text-sm text-slate-700">
                           {lastObs?.obstetric.dilation !== undefined ? `${lastObs.obstetric.dilation}cm` : '-'}
                         </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-100 flex flex-col items-center justify-center text-center">
                         <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">PA</span>
                         <span className="font-bold text-sm text-slate-700">
                           {lastObs?.vitals.paSystolic ? `${lastObs.vitals.paSystolic}x${lastObs.vitals.paDiastolic}` : '-'}
                         </span>
                      </div>
                   </div>
                )}
                
                {/* Next Task Footer */}
                {!isExpanded && !isResolved && nextTask && (
                   <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs">
                       <Clock className={`w-3 h-3 ${new Date(nextTask.timestamp) < new Date() ? 'text-red-500' : 'text-slate-400'}`} />
                       <span className={`font-bold ${new Date(nextTask.timestamp) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>
                          {new Date(nextTask.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                       <span className="text-slate-400">
                          - {nextTask.focus.join(', ')}
                       </span>
                   </div>
                )}

                {/* Expanded Content */}
                {isExpanded && (
                   <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                      {/* Action Links */}
                      <div className="flex justify-end mb-4">
                         <Link 
                              to={`/patient/${patient.id}`}
                              className="text-medical-600 hover:text-medical-700 font-bold text-sm bg-white border border-medical-200 hover:bg-medical-50 px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-2"
                         >
                            Ver Detalhes Completos &rarr;
                         </Link>
                      </div>
                      <ExpandedContent patient={patient} observations={expandedObservations} isLoading={loadingObs} />
                   </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            {showResolved ? 'Nenhum paciente resolvido.' : 'Nenhum paciente ativo.'}
          </div>
        )}
      </div>

      {/* DESKTOP VIEW (TABLE) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                        <th className="p-4 w-10"></th>
                        <th className="p-4 w-20 text-center">Leito</th>
                        <th className="p-4">Paciente / IG</th>
                        <th className="p-4">Obstétrico (Último)</th>
                        <th className="p-4">Vitas (Último)</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 w-20"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {activePatients.length > 0 ? (
                        activePatients.map(patient => {
                            const lastObs = patient.lastObservation;
                            const nextTask = getNextTask(patient);
                            const hasAlert = patient.riskFactors && patient.riskFactors.length > 0;
                            const isExpanded = expandedPatientId === patient.id;
                            
                            // Check for BCF abnormality on last observation
                            const isBcfAbnormal = lastObs?.obstetric.bcf !== undefined && (lastObs.obstetric.bcf < 110 || lastObs.obstetric.bcf > 160);
                            
                            const isResolved = patient.status === PatientStatus.DISCHARGED || patient.status === PatientStatus.PARTOGRAM_OPENED;

                            return (
                                <React.Fragment key={patient.id}>
                                    <tr 
                                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/80'} ${isResolved ? 'bg-slate-50 opacity-70' : ''}`}
                                        onClick={() => toggleExpand(patient.id)}
                                    >
                                        <td className="p-4 text-center">
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                        </td>
                                        
                                        {/* Bed */}
                                        <td className="p-4 text-center">
                                            <div className={`text-xl font-bold rounded-lg py-2 border inline-block w-12 text-center ${isResolved ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-medical-50 text-medical-700 border-medical-100'}`}>
                                                {patient.bed}
                                            </div>
                                        </td>

                                        {/* Patient Info */}
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 text-base">
                                                    {patient.name}
                                                </span>
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
                                                            {lastObs.obstetric.dilation !== undefined ? `${lastObs.obstetric.dilation} cm` : 
                                                             (lastObs.obstetric.cervixStatus && lastObs.obstetric.cervixStatus.length > 0 ? lastObs.obstetric.cervixStatus.join(',') : '-')}
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">Dilatação</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Activity className={`w-4 h-4 ${isBcfAbnormal ? 'text-red-500' : 'text-rose-400'}`} />
                                                        <span className={`font-bold ${isBcfAbnormal ? 'text-red-600' : 'text-slate-700'}`}>
                                                            {lastObs.obstetric.bcf !== undefined ? lastObs.obstetric.bcf : '-'}
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">bpm</span>
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
                                                        <span className="font-bold text-slate-700">
                                                            {lastObs.vitals.paSystolic !== undefined ? `${lastObs.vitals.paSystolic}x${lastObs.vitals.paDiastolic}` : '-'}
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">mmHg</span>
                                                    </div>
                                                    
                                                    {/* MgSO4 Data (if applicable) */}
                                                    {patient.useMagnesiumSulfate && lastObs.magnesiumData && (
                                                        <div className="bg-purple-50 text-purple-800 text-xs px-2 py-1 rounded border border-purple-100 inline-block">
                                                            Reflexo: {lastObs.magnesiumData.reflex}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sem dados</span>
                                            )}
                                        </td>

                                        {/* Status / Schedule */}
                                        <td className="p-4">
                                            {isResolved ? (
                                                <div className="text-xs font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded inline-block border border-slate-200">
                                                    {patient.status === PatientStatus.PARTOGRAM_OPENED ? 'Partograma' : 'Alta/Transf.'}
                                                </div>
                                            ) : nextTask ? (
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
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Detalhes
                                            </Link>
                                        </td>
                                    </tr>
                                    
                                    {/* EXPANDED ROW CONTENT */}
                                    {isExpanded && (
                                        <tr className="bg-slate-50">
                                            <td colSpan={7} className="p-0 border-b border-slate-200">
                                                <div className="p-4">
                                                   <ExpandedContent patient={patient} observations={expandedObservations} isLoading={loadingObs} />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                {showResolved ? 'Nenhum paciente resolvido encontrado.' : 'Nenhum paciente ativo encontrado com estes filtros.'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
            <span>Mostrando {activePatients.length} pacientes</span>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-red-100 ml-2"></div> Atrasado
            </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;