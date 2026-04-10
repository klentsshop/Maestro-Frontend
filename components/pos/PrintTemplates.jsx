'use client';
import React, { memo } from 'react';
import styles from '@/app/MenuPanel.module.css';
// ✅ Importamos la configuración maestra
import { SITE_CONFIG } from '@/lib/config';

export const PrintTemplates = memo(({
    cart,
    total,
    ordenMesa,
    nombreMesero,
    config, 
    agrupadoCliente,
    agrupadoCocina,
    ordenActivaId,
    cleanPrice,
    propina = 0,
    montoManual = 0 
}) => {
    // Usamos SITE_CONFIG como base, o config si viniera de afuera
    const activeConfig = SITE_CONFIG.brand;
    const logicConfig = SITE_CONFIG.logic;

    if (!activeConfig) return null;

    // 🧮 Cálculos internos para el desglose del ticket
    const subtotalProductos = (agrupadoCliente || []).reduce((acc, it) => acc + (it.subtotal || 0), 0);
    
    // Si propina es -1 (Manual), el valor sugerido es 0 y usamos montoManual puro
    const valorPropinaSugerida = propina === -1 ? 0 : (subtotalProductos * (propina / 100));
    const propinaTotal = valorPropinaSugerida + Number(montoManual);

    const platosFinalesCocina = agrupadoCocina || [];
    return (
        <div className={styles.printArea}>

            {/* ================= TICKET CLIENTE ================= */}
            <div id="ticket-print" className="seccion-impresion-termica" suppressHydrationWarning>
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <h2 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', fontWeight: 'bold' }}>
                        {activeConfig.name}
                    </h2>
                    {activeConfig.nit && <p style={{ margin: 0, fontSize: '0.9rem' }}>NIT: {activeConfig.nit}</p>}
                    <p style={{ margin: 0 }}>{activeConfig.address}</p>
                    {activeConfig.phone && <p style={{ margin: 0 }}>Tel: {activeConfig.phone}</p>}

                    <div
                        style={{
                            margin: '10px 0',
                            borderTop: '1px dashed black',
                            borderBottom: '1px dashed black',
                            padding: '6px 0'
                        }}
                    >
                        <strong>
                            {ordenActivaId ? '--- PRE-CUENTA ---' : '--- COMPROBANTE ---'}
                        </strong>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid black' }}>
                                <th style={{ textAlign: 'left', width: '12mm' }}>Cant</th>
                                <th style={{ textAlign: 'left', width: '38mm' }}>Producto</th>
                                <th style={{ textAlign: 'right', width: '24mm' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(agrupadoCliente || []).map((item, idx) => (
                                <tr key={idx}>
                                    <td style={{ textAlign: 'left' }}>{item.cantidad}</td>
                                    <td
                                        style={{
                                            textAlign: 'left',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {item.nombre}
                                    </td><td style={{ textAlign: 'right' }}>
                                        {activeConfig.symbol}{(item.subtotal || 0).toLocaleString(activeConfig.currency)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '10px', borderTop: '1px solid black', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span>Subtotal:</span>
                            <span>{activeConfig.symbol}{subtotalProductos.toLocaleString(activeConfig.currency)}</span>
                        </div>
                        {propinaTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span>Propina/Servicio:</span>
                                <span>{activeConfig.symbol}{propinaTotal.toLocaleString(activeConfig.currency)}</span>
                            </div>
                        )}
                        <div
                            style={{
                                marginTop: '5px',
                                borderTop: '2px solid black',
                                paddingTop: '5px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontWeight: 'bold',
                                fontSize: '1.2rem'
                            }}
                        >
                            <span>TOTAL:</span>
                            <span>{activeConfig.symbol}{(total || 0).toLocaleString(activeConfig.currency)}</span>
                        </div>
                    </div>

                    {activeConfig.mensajeTicket && (
                        <p style={{ marginTop: '15px', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            {activeConfig.mensajeTicket}
                        </p>
                    )}
                </div>
            </div>

            {/* ================= COMANDA COCINA ================= */}
            <div id="comanda-print" className="seccion-impresion-termica" suppressHydrationWarning>
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <h2 style={{ fontSize: '1.8rem', margin: 0 }}>
                        MESA: {ordenMesa || '0'}
                    </h2>
                    <p style={{ fontSize: '1.1rem' }}>
                        Atiende: {nombreMesero || 'General'}
                    </p>

                    <hr style={{ border: '1px dashed black' }} />

                    <table style={{ width: '100%', fontSize: '1.3rem', borderCollapse: 'collapse' }}>
                        <tbody>
                            {(() => {
                                const bebidaKeywords = ["agua", "gaseosa", "jugo", "coca", "pepsi", "sprite", "cerveza"];

                                const platos = platosFinalesCocina.filter(item => {
                                    const nombreSeguro = String(item.nombre || item.nombrePlato || "").toLowerCase();
                                    return !bebidaKeywords.some(k => nombreSeguro.includes(k.toLowerCase()));
                                });

                                const bebidas = platosFinalesCocina.filter(item => {
                                    const nombreSeguro = String(item.nombre || item.nombrePlato || "").toLowerCase();
                                    return bebidaKeywords.some(k => nombreSeguro.includes(k.toLowerCase()));
                                });

                                const ordenarPlatos = (a, b) => {
                                    const keywords = logicConfig?.priorityKeywords || ['almuerzo'];
                                    const nameA = String(a.nombre || a.nombrePlato || "").toLowerCase();
                                    const nameB = String(b.nombre || b.nombrePlato || "").toLowerCase();
                                    
                                    const esPriA = keywords.some(k => nameA.includes(k.toLowerCase()));
                                    const esPriB = keywords.some(k => nameB.includes(k.toLowerCase()));

                                    if (esPriA && !esPriB) return -1;
                                    if (!esPriA && esPriB) return 1;
                                    return nameA.localeCompare(nameB);
                                };

                                return (
                                    <>
                                        {platos.sort(ordenarPlatos).map((item, idx) => (
                                            <tr key={`plato-${item.lineId || idx}`} style={{ borderBottom: '1px solid #000' }}>
                                                <td style={{ fontWeight: 'bold', width: '45px', verticalAlign: 'top', textAlign: 'left', padding: '5px 0' }}>
                                                    {item.cantidad}x
                                                </td><td style={{ textAlign: 'left', padding: '5px 0' }}>
                                                    <div style={{ fontWeight: 'bold', lineHeight: '1.2' }}>
                                                        {item.nombre || item.nombrePlato}
                                                    </div>
                                                    {item.comentario && (
                                                        <div style={{ fontSize: '1.1rem', fontStyle: 'italic', marginTop: '2px' }}>
                                                            ** {item.comentario}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {bebidas.map((item, idx) => (
                                            <tr key={`bebida-${item.lineId || idx}`} style={{ borderBottom: '1px solid #000' }}>
                                                <td style={{ fontWeight: 'bold', width: '45px', verticalAlign: 'top', textAlign: 'left', padding: '5px 0' }}>
                                                    {item.cantidad}x
                                                </td><td style={{ textAlign: 'left', padding: '5px 0' }}>
                                                    <div style={{ fontWeight: 'bold' }}>{item.nombre || item.nombrePlato}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>

                    <div style={{ borderTop: '1px solid black', marginTop: '10px', paddingTop: '5px', fontSize: '0.8rem' }} suppressHydrationWarning>
                        {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
});

PrintTemplates.displayName = 'PrintTemplates';