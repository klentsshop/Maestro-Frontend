'use client';

import React from 'react';

export default function ModalPagoMixto({ total, montos, setMontos, onClose }) {
    // 🛡️ LUPA: Cálculos en tiempo real asegurando tipos numéricos
    const efectivo = Number(montos.efectivo || 0);
    const tarjeta = Number(montos.tarjeta || 0);
    const digital = Number(montos.digital || 0);

    const sumaActual = efectivo + tarjeta + digital;
    const diferencia = total - sumaActual;
    const isCuadrado = Math.abs(diferencia) < 1;

    // ✨ BISTURÍ: Manejo de inputs sin errores de concatenación
    const handleInputChange = (campo, valor) => {
        // Permitir que el campo se vea vacío mientras el usuario escribe, pero guardar el número en el estado
        const numVal = valor === '' ? 0 : Number(valor);
        setMontos({
            ...montos,
            [campo]: valor === '' ? '' : numVal
        });
    };

    // ⚡ AUTOCOMPLETAR: Calcula el faltante para el campo seleccionado
    const autoCompletar = (campo) => {
        const montoActualDelCampo = Number(montos[campo] || 0);
        const otrosMontosSuma = sumaActual - montoActualDelCampo;
        const faltante = total - otrosMontosSuma;
        
        handleInputChange(campo, faltante > 0 ? faltante : 0);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', 
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)',
            padding: '10px'
        }}>
            <div style={{
                backgroundColor: 'white', padding: '24px', borderRadius: '20px',
                width: '100%', maxWidth: '360px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                animation: 'modalIn 0.3s ease-out'
            }}>
                {/* CABECERA */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#111827', fontWeight: '800' }}>💰 Repartir Pago</h3>
                    <p style={{ margin: '5px 0 0', color: '#6B7280', fontSize: '0.95rem' }}>
                        Total a cubrir: <span style={{ fontWeight: '900', color: '#7c3aed' }}>${total.toLocaleString('es-CO')}</span>
                    </p>
                </div>

                {/* FORMULARIO DE MONTOS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* EFECTIVO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#4B5563', paddingLeft: '4px' }}>💵 EFECTIVO</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                value={montos.efectivo} 
                                onChange={(e) => handleInputChange('efectivo', e.target.value)}
                                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid #E5E7EB', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none' }} 
                                placeholder="0" 
                            />
                            <button onClick={() => autoCompletar('efectivo')} style={{ width: '48px', borderRadius: '12px', border: 'none', backgroundColor: '#F3F4F6', color: '#7c3aed', fontSize: '1.2rem', cursor: 'pointer' }}>⚡</button>
                        </div>
                    </div>

                    {/* TARJETA */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#4B5563', paddingLeft: '4px' }}>💳 TARJETA</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                value={montos.tarjeta} 
                                onChange={(e) => handleInputChange('tarjeta', e.target.value)}
                                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid #E5E7EB', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none' }} 
                                placeholder="0" 
                            />
                            <button onClick={() => autoCompletar('tarjeta')} style={{ width: '48px', borderRadius: '12px', border: 'none', backgroundColor: '#F3F4F6', color: '#7c3aed', fontSize: '1.2rem', cursor: 'pointer' }}>⚡</button>
                        </div>
                    </div>

                    {/* DIGITAL */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#4B5563', paddingLeft: '4px' }}>📱 DIGITAL</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                value={montos.digital} 
                                onChange={(e) => handleInputChange('digital', e.target.value)}
                                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid #E5E7EB', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none' }} 
                                placeholder="0" 
                            />
                            <button onClick={() => autoCompletar('digital')} style={{ width: '48px', borderRadius: '12px', border: 'none', backgroundColor: '#F3F4F6', color: '#7c3aed', fontSize: '1.2rem', cursor: 'pointer' }}>⚡</button>
                        </div>
                    </div>
                </div>

                {/* INDICADOR VISUAL DE CUADRE */}
                <div style={{ 
                    marginTop: '24px', padding: '14px', borderRadius: '14px',
                    backgroundColor: isCuadrado ? '#D1FAE5' : '#FEE2E2',
                    textAlign: 'center', fontSize: '1rem', fontWeight: '900',
                    color: isCuadrado ? '#065F46' : '#991B1B',
                    border: isCuadrado ? '1px solid #34D399' : '1px solid #F87171'
                }}>
                    {isCuadrado ? "✅ SUMA CORRECTA" : 
                     diferencia > 0 ? `FALTAN: $${diferencia.toLocaleString('es-CO')}` : 
                     `SOBRAN:$${Math.abs(diferencia).toLocaleString('es-CO')}`}
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button 
                        onClick={() => {
                            setMontos({ efectivo: 0, tarjeta: 0, digital: 0 });
                            onClose();
                        }} 
                        style={{ flex: 1, padding: '16px', borderRadius: '14px', backgroundColor: '#F9FAFB', color: '#4B5563', border: '1px solid #E5E7EB', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        CANCELAR
                    </button>
                    
                    <button 
                        onClick={onClose} // 👈 SOLO CIERRA EL MODAL para usar el botón de afuera
                        disabled={!isCuadrado}
                        style={{
                            flex: 1.5, padding: '16px', borderRadius: '14px',
                            backgroundColor: isCuadrado ? '#7c3aed' : '#D1D5DB', 
                            color: 'white', border: 'none', fontWeight: '900', fontSize: '1rem',
                            cursor: isCuadrado ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s'
                        }}
                    >
                        APLICAR 
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes modalIn {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}