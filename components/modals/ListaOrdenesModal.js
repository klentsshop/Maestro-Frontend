import React from 'react';

export default function ListaOrdenesModal({ isOpen, onClose, ordenes, onCargar }) {
    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 6000 }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 10, width: '90%', maxWidth: 400 }}>
                <h3 style={{ marginBottom: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Órdenes Activas ({ordenes.length})
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2em', cursor: 'pointer' }}>✕</button>
                </h3>
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {ordenes.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#6B7280' }}>No hay órdenes pendientes</p>
                    ) : (
                        ordenes.map(orden => (
                            <div key={orden._id} style={{ border: '1px solid #ccc', padding: 10, margin: '5px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '5px' }}>
                                <div>
                                    <strong style={{ textTransform: 'uppercase' }}>{orden.mesa}</strong>
                                    <p style={{ fontSize: '0.8em', color: '#6B7280', margin: 0 }}>👤 {orden.mesero}</p>
                                </div>
                                <button 
                                    onClick={() => onCargar(orden._id)} 
                                    style={{ padding: '8px 12px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                >
                                    Cargar
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}