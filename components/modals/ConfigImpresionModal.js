'use client';
import React, { useState, useEffect } from 'react';
import { Settings, Save, Monitor, CheckCircle } from 'lucide-react';
import { sanityClientServer as client } from '@/lib/sanity';
import { getStationFingerprint } from '@/lib/utils';

export default function ConfigImpresionModal({ isOpen, onClose, categorias }) {
    const [nombreEstacion, setNombreEstacion] = useState('');
    const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
    const [fingerprint, setFingerprint] = useState('');
    const [guardando, setGuardando] = useState(false);

    // 🛡️ GENERADOR DE FINGERPRINT (ID ÚNICO DE PC)
    // 🛡️ GENERADOR DE FINGERPRINT (ID ÚNICO DE PC)
useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
        // 1. Forzamos la creación/recuperación del ID en el disco
        const idUnico = getStationFingerprint(); 
        
        // 2. Lo subimos al estado para que se vea en el encabezado verde
        setFingerprint(idUnico);
        console.log("🆔 ID Generado y Guardado en LocalStorage:", idUnico);

        // 3. Con el ID ya "anclado", buscamos en Sanity
        cargarConfiguracion(idUnico);
    }
}, [isOpen]);

    const cargarConfiguracion = async (id) => {
        const query = `*[_type == "estacionPC" && pcFingerprint == $id][0]`;
        const data = await client.fetch(query, { id });
        if (data) {
            setNombreEstacion(data.nombre);
            setCategoriasSeleccionadas(data.categoriasVinculadas || []);
        }
    };

    const toggleCategoria = (cat) => {
        setCategoriasSeleccionadas(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const guardarEnSanity = async () => {
    setGuardando(true);
    try {
        // 🚀 BISTURÍ: Enviamos los datos a nuestra propia API
        const res = await fetch('/api/estaciones/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fingerprint: fingerprint,
                nombre: nombreEstacion || 'Caja Nueva',
                categorias: categoriasSeleccionadas // Enviamos el array de strings
            })
        });

        const data = await res.json();

        if (data.success) {
            alert('✅ Estación Guardada en la Nube');
            onClose();
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
    } catch (error) {
        console.error("🔥 Error al guardar estación:", error);
        alert('❌ Error al guardar: Revisa la consola del servidor');
    } finally {
        setGuardando(false);
    }
   };

    if (!isOpen) return null;

    return (
    <div style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: '20px', backdropFilter: 'blur(4px)'
    }}>
        <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%',
            maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden', border: '1px solid #e5e7eb', fontFamily: 'sans-serif'
        }}>
            {/* Header Estilo Talanquera */}
            <div style={{
                backgroundColor: '#1f2937', color: 'white', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '12px'
            }}>
                <Monitor size={24} color="#10b981" />
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Configuración de Estación</h2>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>ID Único: {fingerprint}</p>
                </div>
                <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
            </div>

            <div style={{ padding: '24px' }}>
                {/* Campo Nombre */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Nombre de esta PC</label>
                    <input 
                        type="text"
                        value={nombreEstacion}
                        onChange={(e) => setNombreEstacion(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #f3f4f6', outline: 'none', fontSize: '1rem' }}
                        placeholder="Ej: Caja Principal"
                    />
                </div>

                {/* Checklist de Categorías */}
                <div>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '12px', textTransform: 'uppercase' }}>Categorías por Cable (80mm)</label>
                    <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                        {categorias.map(cat => (
                            <div 
                                key={cat}
                                onClick={() => toggleCategoria(cat)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px', borderRadius: '12px', cursor: 'pointer',
                                    border: categoriasSeleccionadas.includes(cat) ? '2px solid #10b981' : '2px solid #f9fafb',
                                    backgroundColor: categoriasSeleccionadas.includes(cat) ? '#ecfdf5' : '#f9fafb',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontWeight: '600', color: '#1f2937' }}>{cat}</span>
                                {categoriasSeleccionadas.includes(cat) && <CheckCircle size={20} color="#10b981" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Botones de Acción */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: '#f3f4f6', color: '#4b5563', cursor: 'pointer' }}>
                        Cancelar
                    </button>
                    <button 
                        onClick={guardarEnSanity}
                        disabled={guardando}
                        style={{ 
                            flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', 
                            backgroundColor: '#10b981', color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <Save size={18} />
                        {guardando ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    </div>
);
}