
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient } from '../types';
import { ArrowLeft, Pill, Beaker, Save, Trash2, AlertTriangle } from 'lucide-react';

const EditPatient: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    bed: '',
    riskFactors: '',
    useMethyldopa: false,
    useMagnesiumSulfate: false
  });

  useEffect(() => {
    if (id) {
        patientService.getPatientById(id).then(p => {
            if (p) {
                setFormData({
                    name: p.name,
                    bed: p.bed,
                    riskFactors: p.riskFactors ? p.riskFactors.join(', ') : '',
                    useMethyldopa: p.useMethyldopa || false,
                    useMagnesiumSulfate: p.useMagnesiumSulfate || false
                });
            }
            setLoading(false);
        });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);

    try {
      await patientService.updatePatient(id, {
        name: formData.name,
        bed: formData.bed,
        riskFactors: formData.riskFactors ? formData.riskFactors.split(',').map(s => s.trim()) : [],
        useMethyldopa: formData.useMethyldopa,
        useMagnesiumSulfate: formData.useMagnesiumSulfate
      });
      navigate(`/patient/${id}`);
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
      if (!id) return;
      if (confirm('ATENÇÃO: Tem certeza que deseja excluir permanentemente este paciente e todo o histórico de evoluções? Esta ação não pode ser desfeita.')) {
          setIsSubmitting(true);
          try {
              await patientService.deletePatient(id);
              navigate('/');
          } catch (error) {
              console.error(error);
              alert('Erro ao excluir paciente.');
              setIsSubmitting(false);
          }
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Editar Paciente</h1>
      </div>

      <div className="space-y-6">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            
            {/* Bed Number */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Número do Leito</label>
              <input
                required
                name="bed"
                type="text"
                className="w-full p-4 border border-slate-300 rounded-lg text-2xl font-bold text-medical-600 bg-white focus:ring-2 focus:ring-medical-500 focus:outline-none"
                value={formData.bed}
                onChange={handleChange}
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input
                required
                name="name"
                type="text"
                className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            {/* Risk Factors */}
            <div>
                <label className="block text-xs text-slate-500 mb-1">Comorbidades / Fatores de Risco</label>
                <textarea 
                  name="riskFactors" 
                  placeholder="Ex: HAS, Diabetes, etc..." 
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none h-24 bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" 
                  value={formData.riskFactors} 
                  onChange={handleChange} 
                />
            </div>

            {/* Protocols */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Protocolos Especiais</h3>
                
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      name="useMethyldopa" 
                      checked={formData.useMethyldopa} 
                      onChange={handleChange}
                      className="w-5 h-5 text-medical-600 rounded focus:ring-medical-500" 
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Pill className="w-4 h-4 text-medical-500" />
                            Uso de Metildopa
                        </span>
                        <span className="text-[10px] text-slate-400">Habilita coleta de PA sentada e em pé</span>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors">
                    <input 
                      type="checkbox" 
                      name="useMagnesiumSulfate" 
                      checked={formData.useMagnesiumSulfate} 
                      onChange={handleChange}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500" 
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Beaker className="w-4 h-4 text-purple-500" />
                            Sulfato de Magnésio
                        </span>
                        <span className="text-[10px] text-slate-400">Protocolo de neuroproteção</span>
                    </div>
                </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-medical-600 text-white font-bold py-4 rounded-xl shadow hover:bg-medical-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Salvando...' : <><Save className="w-5 h-5" /> Salvar Alterações</>}
            </button>
          </form>

          {/* Delete Zone */}
          <div className="bg-red-50 p-6 rounded-xl border border-red-100">
              <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" /> Zona de Perigo
              </h3>
              <p className="text-xs text-red-600 mb-4">
                  Excluir o paciente removerá permanentemente todos os dados, incluindo histórico de aferições e gráficos.
              </p>
              <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="w-full bg-white border border-red-200 text-red-600 font-bold py-3 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                  <Trash2 className="w-4 h-4" />
                  Excluir Paciente
              </button>
          </div>
      </div>
    </div>
  );
};

export default EditPatient;
