'use client';

import React, { useState } from 'react';

// 🚀 IMPORTANTE: Agregamos el export default aquí mismo
export default function HistorialVentasModal({ isOpen, onClose, onReimprimir }) {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [ventas, setVentas] = useState([]);
    const [buscando, setBuscando] = useState(false);

    const obtenerVentas = async () => {
        setBuscando(true);
        try {
            const res = await fetch('/api/ventas/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechaSeleccionada: fecha })
            });
            const data = await res.json();
            setVentas(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Error al obtener historial:", e);
            alert("Error al conectar con el servidor");
        } finally {
            setBuscando(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ backgroundColor: 'white', width: '95%', maxWidth: '500px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderBottom: '1px solid #eee', backgroundColor: '#f8fafc' }}>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem' }}>📋 Historial de Ventas</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>

                <div style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>SELECCIONAR DÍA:</label>
                        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }} />
                    </div>

                    <button onClick={obtenerVentas} disabled={buscando} style={{ width: '100%', padding: '14px', backgroundColor: buscando ? '#94a3b8' : '#1abc9c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: buscando ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                        {buscando ? 'BUSCANDO...' : '🔍 VER VENTAS'}
                    </button>

                    <div style={{ maxHeight: '350px', overflowY: 'auto', marginTop: '20px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                        {ventas.length > 0 ? (
                            ventas.map(v => (
                                <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.95rem' }}>{v.folio || 'S/F'} - {v.mesa}</div>
                                        <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>👤 {v.mesero || 'Caja'} • 💰 <strong>${Number(v.totalPagado).toLocaleString()}</strong></div>
                                    </div>
                                    <button onClick={() => onReimprimir(v)} style={{ backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 15px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Ticket</button>
                                </div>
                            ))
                        ) : (
                            !buscando && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>No hay ventas para este día.</div>
                        )}
                    </div>
                </div>
                
                <div style={{ padding: '15px 20px', backgroundColor: '#f8fafc', textAlign: 'right', borderTop: '1px solid #eee' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontWeight: 'bold', cursor: 'pointer' }}>CERRAR</button>
                </div>
            </div>
        </div>
    );
}