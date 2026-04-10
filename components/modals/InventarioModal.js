'use client';

import React, { useState } from 'react';
import { useInventario } from '@/hooks/useInventario';
import styles from '../../app/MenuPanel.module.css'; 

export default function InventarioModal({ isOpen, onClose }) {
    const { insumos, cargarStock, cargando } = useInventario();
    const [busqueda, setBusqueda] = useState('');
    const [cantidades, setCantidades] = useState({});
    // 💡 Estado para validación visual individual
    const [confirmacion, setConfirmacion] = useState({});

    if (!isOpen) return null;

    // 🛡️ LÓGICA DE FILTRADO Y ALERTA SENIOR
    const insumosProcesados = insumos?.filter(i => 
        (i.nombre || "").toLowerCase().includes(busqueda.toLowerCase())
    ).sort((a, b) => {
        const criticoA = a.stockActual <= (a.stockMinimo || 5) ? 1 : 0;
        const criticoB = b.stockActual <= (b.stockMinimo || 5) ? 1 : 0;
        return criticoB - criticoA; 
    }) || [];

    const handleCargar = async (id) => {
        const cantidad = cantidades[id];
        if (!cantidad || cantidad <= 0) return;
        
        const ok = await cargarStock(id, cantidad);
        if (ok) {
            // ✅ Activar validación visual
            setConfirmacion(prev => ({ ...prev, [id]: true }));
            window.dispatchEvent(new Event('inventarioActualizado'));
            
            setCantidades(prev => {
                const newCantidades = { ...prev };
                delete newCantidades[id];
                return newCantidades;
            });

            // Limpiar validación visual tras 2 segundos
            setTimeout(() => {
                setConfirmacion(prev => ({ ...prev, [id]: false }));
            }, 2000);
        }
    };

    return (
        /* FONDO OSCURO QUE CUBRE TODA LA PANTALLA (OVERLAY) */
        <div style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            padding: '15px', 
            zIndex: 10000 
        }}>
            
            {/* CONTENEDOR BLANCO (LA VENTANA DEL MODAL) */}
            <div style={{ 
                background: 'white', 
                padding: '25px', 
                borderRadius: '15px', 
                width: '100%', 
                maxWidth: '650px', 
                maxHeight: '90vh', 
                overflowY: 'auto', 
                position: 'relative',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
            }}>
                
                {/* ENCABEZADO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        📊 CONTROL DE STOCK
                    </h2>
                    <button onClick={onClose} style={{ fontSize: '1.8rem', border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
                </div>

                {/* FILTRO DE BÚSQUEDA */}
                <div style={{ backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#4B5563', textTransform: 'uppercase', marginBottom: '5px', display: 'block' }}>
                        🔍 Buscar Insumo en Almacén:
                    </label>
                    <input 
                        type="text" 
                        placeholder="Ej: Carne, Cerveza, Gaseosa..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ 
                            width: '100%', padding: '12px', borderRadius: '8px', 
                            border: '1px solid #D1D5DB', outline: 'none', fontSize: '1rem',
                            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    />
                </div>

                {/* TABLA DE INSUMOS */}
                <div style={{ maxHeight: '50vh', overflowY: 'auto', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F1F5F9', zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Insumo</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Stock Real</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Cargar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {insumosProcesados.map((insumo) => {
                                const esCritico = insumo.stockActual <= (insumo.stockMinimo || 5);
                                const guardadoOk = confirmacion[insumo._id];
                                return (
                                    <tr key={insumo._id} style={{ 
                                        borderBottom: '1px solid #F3F4F6',
                                        backgroundColor: guardadoOk ? '#ECFDF5' : (esCritico ? '#FFF7F7' : 'transparent'),
                                        transition: 'background-color 0.3s ease'
                                    }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1F2937' }}>{insumo.nombre?.toUpperCase()}</div>
                                            <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 'bold' }}>UNIDAD: {insumo.unidadMedida?.toUpperCase() || 'UND'}</span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: esCritico ? '#EF4444' : '#10B981' }}>{insumo.stockActual}</div>
                                            {esCritico && (
                                                <span style={{ fontSize: '0.6rem', backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '2px 6px', borderRadius: '4px', fontWeight: '900' }}>⚠️ AGOTÁNDOSE</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                <input 
                                                    type="number" 
                                                    placeholder="0"
                                                    value={cantidades[insumo._id] || ''}
                                                    onChange={(e) => setCantidades({...cantidades, [insumo._id]: e.target.value})}
                                                    style={{ width: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', textAlign: 'center', fontWeight: 'bold' }}
                                                />
                                                <button 
                                                    onClick={() => handleCargar(insumo._id)}
                                                    disabled={cargando}
                                                    style={{ 
                                                        background: guardadoOk ? '#059669' : '#10B981', 
                                                        color: 'white', border: 'none', padding: '8px 15px', 
                                                        borderRadius: '6px', fontWeight: '900', fontSize: '0.75rem', 
                                                        cursor: 'pointer', opacity: cargando ? 0.5 : 1,
                                                        minWidth: '65px', transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    {guardadoOk ? '✅ OK' : '+ OK'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* BOTÓN CERRAR */}
                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                    <button onClick={onClose} style={{ padding: '12px 25px', borderRadius: '8px', background: '#4B5563', color: 'white', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        Cerrar Panel
                    </button>
                </div>
            </div>
        </div>
    );
}