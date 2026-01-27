
import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus, Observation } from '../types';
import { patientService, get24hStats } from '../services/supabaseService';
import { Search, Share2, Activity, Clock, Ruler, Check, ChevronDown, ChevronUp, Copy, Clipboard, FileText, Filter, BedDouble, AlertCircle, Maximize2, Minimize2, X, Trash2, ArrowDownAZ, ArrowDown01, Baby } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VitalCharts } from '../components/VitalCharts';

// --- Helper Component for Expanded Content ---
const ExpandedContent = ({ patient, observations, isLoading }: { patient: Patient, observations: Observation[], isLoading: boolean }) => {
    const [isChartMaximized, setIsChartMaximized] = useState(false);

    // Function to generate the prontuario text (kept local to this component for the button)
    const formatToqueVaginal = (o: Observation['obstetric']) => {
        const parts = [];
        if (o.effacement !== undefined) parts.push(o.effacement === 0 ? 'G' : `${o.effacement}% AP`);
        const posMap: Record<string, string> = { 'Posterior': 'P', 'Intermediário': 'I', 'Central': 'C' };
        if (o.cervixPosition && posMap[o.cervixPosition]) parts.push(posMap[o.cervixPosition]);
        const conMap: Record<string, string> = { 'Nasal': 'N', 'Nasolabial': 'NL', 'Labial': 'L' };
        if (o.cervixConsistency && conMap[o.cervixConsistency]) parts.push(conMap[o.cervixConsistency]);
        if (o.dilation !== undefined && o.dilation > 0) parts.push(`${o.dilation}CM`);
        else if (o.cervixStatus && o.cervixStatus.length > 0) parts.push(o.cervixStatus.join(', '));
        else if (o.dilation === 0) parts.push('0CM');
        
        // Station Logic Updated
        if (o.station !== undefined) {
             if (o.station === -4) parts.push('AM');
             else parts.push(`DE LEE ${o.station > 0 ? '+' : ''}${o.station}`);
        }

        if (o.bloodOnGlove !== undefined) parts.push(o.bloodOnGlove ? 'SDL' : 'SSDL');
        return parts.length > 0 ? `TOQUE: ${parts.join(', ')}` : '';
    };

    const generateProntuarioText = (patient: Patient, obsList: Observation[]) => {
        const sorted = [...obsList].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let text = '';
        let lastDate = '';

        sorted.forEach(o => {
            const dateObj = new Date(o.timestamp);
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
            if (o.obstetric.bcf) lineParts.push(`BCF: ${o.obstetric.bcf} BPM`);
            if (o.vitals.paSystolic) lineParts.push(`PA: ${o.vitals.paSystolic}X${o.vitals.paDiastolic} MMHG`);
            if (o.obstetric.dinamicaSummary) lineParts.push(`DU ${o.obstetric.dinamicaSummary.toUpperCase()}`);
            else if (o.obstetric.dinamicaFrequency) lineParts.push(`DU ${o.obstetric.dinamicaFrequency}/10'`);
            
            const toqueStr = formatToqueVaginal(o.obstetric);
            if (toqueStr) lineParts.push(toqueStr);
            
            if (o.vitals.dxt) lineParts.push(`DXT: ${o.vitals.dxt} MG/DL`);

            if (o.medication?.misoprostolDose) {
                const countStr = o.medication.misoprostolCount ? `${o.medication.misoprostolCount}º ` : '';
                lineParts.push(`${countStr}MISO ${o.medication.misoprostolDose}MCG`);
            }
            if (o.medication?.oxytocinDose) lineParts.push(`OCITOCINA ${o.medication.oxytocinDose} ML/H`);

            if (o.magnesiumData) {
                if (o.magnesiumData.diuresis) lineParts.push(`DIURESE ${o.magnesiumData.diuresis}`);
                if (o.magnesiumData.reflex) lineParts.push(`REFLEXO ${o.magnesiumData.reflex.toUpperCase()}`);
            }
            if (o.notes) lineParts.push(o.notes.toUpperCase());
            text += lineParts.join(' | ') + '\n';
        });

        if (patient.status === PatientStatus.PARTOGRAM_OPENED) {
            text += "\nABERTO PARTOGRAMA E MANTIDO DEMAIS PARÂMETROS REGISTRADOS EM PARTOGRAMA.";
        }
        return text;
    };

    const copyProntuarioToClipboard = () => {
        const text = generateProntuarioText(patient, observations);
        navigator.clipboard.writeText(text);
        alert('Texto copiado para a área de transferência!');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
            
            {/* 1. Charts Column - With Maximize Capability */}
            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all duration-300 ${isChartMaximized ? 'fixed inset-4 z-50 flex flex-col p-6 shadow-2xl' : 'p-4'}`}>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Gráficos de Tendência
                    </h4>
                    <button 
                        onClick={() => setIsChartMaximized(!isChartMaximized)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                        title={isChartMaximized ? "Minimizar" : "Maximizar"}
                    >
                        {isChartMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
                
                {isLoading ? (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>
                ) : (
                    <div className={`${isChartMaximized ? 'flex-1 min-h-0' : 'h-64'} overflow-y-auto custom-scrollbar`}>
                        <VitalCharts observations={observations} isMaximized={isChartMaximized} />
                    </div>
                )}
            </div>

            {/* Backgroup overlay for maximize */}
            {isChartMaximized && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setIsChartMaximized(false)}></div>
            )}

            {/* 2. History List Column - FULL Details */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:col-span-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Clipboard className="w-4 h-4" /> Histórico Completo
                </h4>
                <div className="flex-1 overflow-auto max-h-64 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-400">...</div>
                    ) : observations.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 italic text-sm">Sem registros.</div>
                    ) : (
                        <table className="w-full text-xs min-w-[600px]">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 text-left w-16">Hora</th>
                                    <th className="p-3 text-left w-24">Monitor</th>
                                    <th className="p-3 text-left">Toque Vaginal</th>
                                    <th className="p-3 text-left">Sinais Vitais</th>
                                    <th className="p-3 text-left">Conduta / Obs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {observations.slice(0, 20).map(obs => {
                                    const isBcfBad = obs.obstetric.bcf !== undefined && (obs.obstetric.bcf < 110 || obs.obstetric.bcf > 160);
                                    
                                    return (
                                        <tr key={obs.id} className="hover:bg-slate-50/50">
                                            {/* Hora */}
                                            <td className="p-3 font-bold text-slate-700 align-top">
                                                {new Date(obs.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </td>
                                            
                                            {/* Monitor (BCF / DU) */}
                                            <td className="p-3 align-top">
                                                <div className="flex flex-col gap-1">
                                                    {obs.obstetric.bcf && (
                                                        <span className={`font-bold ${isBcfBad ? 'text-red-600' : 'text-slate-700'}`}>
                                                            BCF: {obs.obstetric.bcf}
                                                        </span>
                                                    )}
                                                    {(obs.obstetric.dinamicaSummary || obs.obstetric.dinamicaFrequency) && (
                                                        <span className="text-[10px] text-slate-500">
                                                            DU: {obs.obstetric.dinamicaSummary || `${obs.obstetric.dinamicaFrequency}/10'`}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Toque */}
                                            <td className="p-3 align-top">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-slate-700">
                                                        {obs.obstetric.dilation !== undefined ? `${obs.obstetric.dilation} cm` : 
                                                         (obs.obstetric.cervixStatus?.join(', ') || '-')}
                                                    </span>
                                                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-1">
                                                        {obs.obstetric.effacement !== undefined && <span>Apag: {obs.obstetric.effacement}%</span>}
                                                        {obs.obstetric.station !== undefined && (
                                                            <span>
                                                                {obs.obstetric.station === -4 ? 'AM' : `De Lee: ${obs.obstetric.station > 0 ? '+' : ''}${obs.obstetric.station}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {obs.obstetric.membranes && (
                                                        <span className="text-[10px] bg-slate-100 px-1 rounded w-fit mt-0.5 border border-slate-200">
                                                            {obs.obstetric.membranes}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Vitais (PA, Tax, Sat, DXT) */}
                                            <td className="p-3 align-top">
                                                <div className="flex flex-col gap-0.5">
                                                    {obs.vitals.paSystolic && (
                                                        <span className="font-bold text-slate-700">
                                                            PA: {obs.vitals.paSystolic}x{obs.vitals.paDiastolic}
                                                        </span>
                                                    )}
                                                    <div className="flex gap-2 text-[10px] text-slate-500 flex-wrap">
                                                        {obs.vitals.tax && <span>T: {obs.vitals.tax}°C</span>}
                                                        {obs.vitals.spo2 && <span>Sat: {obs.vitals.spo2}%</span>}
                                                        {obs.vitals.dxt && <span>DXT: {obs.vitals.dxt}</span>}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Condutas / Protocolos */}
                                            <td className="p-3 align-top">
                                                <div className="flex flex-col gap-1">
                                                    {/* Meds */}
                                                    {(obs.medication?.oxytocinDose || obs.medication?.misoprostolDose) && (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {obs.medication.oxytocinDose && <span className="text-[10px] bg-purple-50 text-purple-700 px-1 rounded border border-purple-100">Oxi: {obs.medication.oxytocinDose}ml/h</span>}
                                                            {obs.medication.misoprostolDose && (
                                                                <span className="text-[10px] bg-purple-50 text-purple-700 px-1 rounded border border-purple-100">
                                                                    {obs.medication.misoprostolCount ? `${obs.medication.misoprostolCount}º ` : ''}Miso: {obs.medication.misoprostolDose}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Mag Protocol */}
                                                    {obs.magnesiumData && (
                                                        <div className="text-[10px] text-indigo-600">
                                                            Refl: {obs.magnesiumData.reflex} | Diu: {obs.magnesiumData.diuresis}
                                                        </div>
                                                    )}

                                                    {/* Notes */}
                                                    {obs.notes && (
                                                        <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]" title={obs.notes}>
                                                            "{obs.notes}"
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* 3. Medical Record Text Generator Column */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:col-span-3">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Copiar para Prontuário
                    </h4>
                    <button 
                        onClick={copyProntuarioToClipboard}
                        className="text-xs bg-medical-50 text-medical-700 hover:bg-medical-100 px-2 py-1 rounded border border-medical-200 flex items-center gap-1 transition-colors"
                    >
                        <Copy className="w-3 h-3" /> Copiar Texto
                    </button>
                </div>
                <div className="flex-1">
                    {isLoading ? (
                        <div className="h-full bg-slate-50 rounded animate-pulse h-24"></div>
                    ) : (
                        <textarea 
                            readOnly
                            className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
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
};

type FilterType = 'all' | 'active' | 'resolved';
type SortType = 'name' | 'bed';

const OverviewPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Controls
  const [filterType, setFilterType] = useState<FilterType>('active');
  const [sortType, setSortType] = useState<SortType>('bed');
  
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir permanentemente este paciente e todo o seu histórico? Esta ação não pode ser desfeita.')) {
        try {
            await patientService.deletePatient(id);
            setPatients(prev => prev.filter(p => p.id !== id));
            if (expandedPatientId === id) setExpandedPatientId(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao excluir paciente.');
        }
    }
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

  const isResolved = (status: PatientStatus) => {
      return [
        PatientStatus.DISCHARGED, 
        PatientStatus.PARTOGRAM_OPENED,
        PatientStatus.DELIVERY,
        PatientStatus.C_SECTION
      ].includes(status);
  };

  const filteredPatients = patients
    .filter(p => {
        // Search Filter
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.bed.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Status Filter
        const resolved = isResolved(p.status);
        if (filterType === 'active') return matchesSearch && !resolved;
        if (filterType === 'resolved') return matchesSearch && resolved;
        return matchesSearch; // 'all'
    })
    .sort((a, b) => {
        // Sort Logic
        if (sortType === 'name') {
            return a.name.localeCompare(b.name);
        } else {
            // Bed sort (numeric aware)
            return a.bed.localeCompare(b.bed, undefined, { numeric: true });
        }
    });


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
      <div className="flex flex-col gap-4 sticky top-16 bg-slate-50 z-20 py-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
            <h1 className="text-2xl font-bold text-slate-900">Visão Geral do Plantão</h1>
            <p className="text-slate-500 text-sm">Monitoramento consolidado e evolução</p>
            </div>

            <button 
                onClick={handleShare}
                className="hidden md:flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors active:scale-95 self-start md:self-auto"
            >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? 'Link Copiado!' : 'Compartilhar'}</span>
            </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                type="text"
                placeholder="Filtrar paciente ou leito..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 shadow-sm"
                />
            </div>
            
            {/* Toolbar: Filters & Sorting */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {/* Filter Group */}
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    <button 
                    onClick={() => setFilterType('active')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'active' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                    Ativos
                    </button>
                    <button 
                    onClick={() => setFilterType('resolved')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'resolved' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                    Resolvidos
                    </button>
                </div>

                {/* Sort Group */}
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    <button 
                    onClick={() => setSortType('bed')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortType === 'bed' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Ordenar por Leito"
                    >
                    <ArrowDown01 className="w-3 h-3" />
                    </button>
                    <button 
                    onClick={() => setSortType('name')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortType === 'name' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Ordenar por Nome"
                    >
                    <ArrowDownAZ className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* MOBILE VIEW (CARDS) */}
      <div className="md:hidden space-y-4">
        {filteredPatients.length > 0 ? (
          filteredPatients.map(patient => {
            const lastObs = patient.lastObservation;
            const stats = get24hStats(patient.observations);
            const history = patient.observations || [];
            
            // --- LAST KNOWN VALUES LOGIC ---
            const lastDilationObs = history.find(o => 
                o.obstetric.dilation !== undefined || 
                (o.obstetric.cervixStatus && o.obstetric.cervixStatus.length > 0)
            );

            const nextTask = getNextTask(patient);
            const isExpanded = expandedPatientId === patient.id;
            const resolved = isResolved(patient.status);
            const isBcfAbnormal = lastObs?.obstetric.bcf !== undefined && (lastObs.obstetric.bcf < 110 || lastObs.obstetric.bcf > 160);

            return (
              <div 
                key={patient.id} 
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isExpanded ? 'border-medical-200 ring-2 ring-medical-100' : 'border-slate-200'} ${resolved ? 'opacity-75 bg-slate-50' : ''}`}
              >
                {/* Card Header (Clickable to Expand) */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50"
                  onClick={() => toggleExpand(patient.id)}
                >
                   <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border font-bold text-lg ${resolved ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-medical-50 text-medical-700 border-medical-100'}`}>
                         <span className="text-[8px] uppercase font-normal opacity-70">Leito</span>
                         {patient.bed}
                      </div>
                      <div>
                         <h3 className="font-bold text-slate-800">{patient.name}</h3>
                         {patient.babyName && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Baby className="w-3 h-3" /> {patient.babyName}
                            </p>
                         )}
                         <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                             <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {patient.gestationalAgeWeeks}s+{patient.gestationalAgeDays}
                             </span>
                             <span>{patient.parity}</span>
                             {resolved && (
                                <span className="bg-slate-600 text-white px-1.5 py-0.5 rounded font-bold">
                                   {patient.status}
                                </span>
                             )}
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      {resolved && (
                          <button 
                            onClick={(e) => handleDelete(e, patient.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          >
                             <Trash2 className="w-5 h-5" />
                          </button>
                      )}
                      <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                         <ChevronDown className="w-5 h-5 text-slate-400" />
                      </div>
                   </div>
                </div>

                {/* Card Body (Last Obs Summary) */}
                {!isExpanded && (
                   <div className="px-4 pb-4 grid grid-cols-3 gap-2 text-xs" onClick={() => toggleExpand(patient.id)}>
                      <div className="bg-rose-50 p-2 rounded border border-rose-100 flex flex-col items-center justify-center text-center">
                         <span className="text-[10px] text-rose-400 font-bold uppercase mb-0.5">BCF (24h)</span>
                         <span className={`font-bold text-sm ${isBcfAbnormal ? 'text-red-600' : 'text-slate-700'}`}>
                           {stats?.hasBcf ? stats.bcf : (lastObs?.obstetric.bcf || '-')}
                         </span>
                      </div>
                      <div className="bg-blue-50 p-2 rounded border border-blue-100 flex flex-col items-center justify-center text-center">
                         <span className="text-[10px] text-blue-400 font-bold uppercase mb-0.5">Dilat</span>
                         <span className="font-bold text-sm text-slate-700">
                           {lastDilationObs 
                             ? (lastDilationObs.obstetric.dilation !== undefined ? `${lastDilationObs.obstetric.dilation}cm` : (lastDilationObs.obstetric.cervixStatus?.join(' ')))
                             : '-'}
                         </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-100 flex flex-col items-center justify-center text-center">
                         <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">PA (24h)</span>
                         <span className="font-bold text-sm text-slate-700">
                           {stats?.hasPa ? `${stats.pas} x ${stats.pad}` : (lastObs?.vitals.paSystolic ? `${lastObs.vitals.paSystolic}x${lastObs.vitals.paDiastolic}` : '-')}
                         </span>
                      </div>
                   </div>
                )}
                
                {/* Next Task Footer */}
                {!isExpanded && !resolved && nextTask && (
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
             Nenhum paciente encontrado.
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
                        <th className="p-4">Obstétrico (24h)</th>
                        <th className="p-4">Vitas (24h)</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 w-20"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredPatients.length > 0 ? (
                        filteredPatients.map(patient => {
                            const lastObs = patient.lastObservation;
                            const stats = get24hStats(patient.observations);
                            const nextTask = getNextTask(patient);
                            const hasAlert = patient.riskFactors && patient.riskFactors.length > 0;
                            const isExpanded = expandedPatientId === patient.id;
                            
                            // Check for BCF abnormality on last observation
                            const isBcfAbnormal = lastObs?.obstetric.bcf !== undefined && (lastObs.obstetric.bcf < 110 || lastObs.obstetric.bcf > 160);
                            
                            const resolved = isResolved(patient.status);

                            const history = patient.observations || [];
                            // --- LAST KNOWN VALUES LOGIC ---
                            const lastDilationObs = history.find(o => 
                                o.obstetric.dilation !== undefined || 
                                (o.obstetric.cervixStatus && o.obstetric.cervixStatus.length > 0)
                            );

                            return (
                                <React.Fragment key={patient.id}>
                                    <tr 
                                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/80'} ${resolved ? 'bg-slate-50 opacity-70' : ''}`}
                                        onClick={() => toggleExpand(patient.id)}
                                    >
                                        <td className="p-4 text-center">
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                        </td>
                                        
                                        {/* Bed */}
                                        <td className="p-4 text-center">
                                            <div className={`text-xl font-bold rounded-lg py-2 border inline-block w-12 text-center ${resolved ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-medical-50 text-medical-700 border-medical-100'}`}>
                                                {patient.bed}
                                            </div>
                                        </td>

                                        {/* Patient Info */}
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 text-base">
                                                    {patient.name}
                                                </span>
                                                {patient.babyName && (
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Baby className="w-3 h-3" /> {patient.babyName}
                                                    </span>
                                                )}
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

                                        {/* Obstetric Stats (24h Range for BCF, Last for Dilation) */}
                                        <td className="p-4">
                                            {lastObs ? (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Ruler className="w-4 h-4 text-slate-400" />
                                                        <span className="font-bold text-slate-700">
                                                            {lastDilationObs 
                                                                ? (lastDilationObs.obstetric.dilation !== undefined ? `${lastDilationObs.obstetric.dilation} cm` : (lastDilationObs.obstetric.cervixStatus?.join(' ')))
                                                                : '-'}
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">Dilatação</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Activity className={`w-4 h-4 ${isBcfAbnormal ? 'text-red-500' : 'text-rose-400'}`} />
                                                        <span className={`font-bold ${isBcfAbnormal ? 'text-red-600' : 'text-slate-700'}`}>
                                                            {stats?.hasBcf ? stats.bcf : (lastObs.obstetric.bcf || '-')}
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">bpm (24h)</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sem dados</span>
                                            )}
                                        </td>

                                        {/* Vitals Stats (24h Ranges) */}
                                        <td className="p-4">
                                            {lastObs ? (
                                                <div className="space-y-1.5">
                                                    {/* PA */}
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Activity className="w-4 h-4 text-indigo-400" />
                                                        <span className="font-bold text-slate-700">
                                                            {stats?.hasPa ? `${stats.pas} x ${stats.pad}` : (lastObs.vitals.paSystolic !== undefined ? `${lastObs.vitals.paSystolic}x${lastObs.vitals.paDiastolic}` : '-')}
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">mmHg (24h)</span>
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
                                            {resolved ? (
                                                <div className="text-xs font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded inline-block border border-slate-200">
                                                    {patient.status}
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
                                            <div className="flex items-center justify-end gap-2">
                                                {resolved && (
                                                    <button 
                                                        onClick={(e) => handleDelete(e, patient.id)}
                                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                        title="Excluir Prontuário"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <Link 
                                                    to={`/patient/${patient.id}`}
                                                    className="text-medical-600 hover:text-medical-700 font-bold text-sm bg-white border border-medical-200 hover:bg-medical-50 px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    Detalhes
                                                </Link>
                                            </div>
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
                                Nenhum paciente encontrado com estes filtros.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
            <span>Mostrando {filteredPatients.length} pacientes</span>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-red-100 ml-2"></div> Atrasado
            </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
