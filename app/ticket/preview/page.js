'use client';
import React, { useEffect, useState } from 'react';
import { SITE_CONFIG } from '@/lib/config';

export default function TicketPreviewPage() {
    const [data, setData] = useState(null);

    useEffect(() => {
        const savedData = sessionStorage.getItem('ticket_preview_data');
        if (savedData) {
            setData(JSON.parse(savedData));
        }
    }, []);

    if (!data) return <p style={{ textAlign: 'center', marginTop: '50px' }}>Cargando ticket...</p>;

    const totalProductos = data.productos.reduce((acc, item) => acc + (item.precioNum * item.cantidad), 0);
    const valorPropina = data.propina === -1 ? data.montoManual : (totalProductos * (data.propina / 100));
    const totalFinal = totalProductos + valorPropina;

    // ✨ Lógica para evitar redundancia (Ej: Evita "DOMICILIO: Domicilio 1")
    const mostrarEncabezadoMesa = () => {
        const tipo = data.tipoOrden?.toUpperCase() || "";
        const mesa = data.mesa || "";
        if (mesa.toUpperCase().includes(tipo)) return mesa; // Si ya dice "Domi", solo muestra "Domi 1"
        return `${tipo}: ${mesa}`; // Si es mesa normal, muestra "MESA: 5"
    };

    return (
        <div style={{ 
            width: '100%', 
            maxWidth: '400px', 
            margin: '0 auto', 
            padding: '20px', 
            backgroundColor: 'white', 
            fontFamily: 'monospace', 
            color: '#000' 
        }}>
           {/* 🏥 PANEL DE CONTROL UNIFICADO (No sale en la impresión) */}
            <div className="no-print" style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                position: 'sticky', // 💡 Tip Senior: Se mantiene arriba si el ticket es largo
                top: '0',
                backgroundColor: 'white',
                padding: '10px 0',
                zIndex: 10
            }}>
                <button 
                    onClick={() => window.close()} 
                    style={{ 
                        flex: 1, 
                        padding: '15px', 
                        backgroundColor: '#666', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '8px', 
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    ⬅️ VOLVER
                </button>

                <button 
                    onClick={() => window.print()} 
                    style={{ 
                        flex: 1.5, // 🚀 Más ancho para que sea el objetivo principal
                        padding: '15px', 
                        backgroundColor: '#000', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '8px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer',
                        fontSize: '1rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)' // Un toque de relieve
                    }}
                >
                    🖨️ IMPRIMIR TICKET
                </button>
            </div>
            {/* 🎫 DISEÑO DEL TICKET */}
            {/* 🎫 DISEÑO DEL TICKET - ENCABEZADO PROFESIONAL */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                {/* Nombre del Establecimiento */}
                <h2 style={{ margin: '0 0 2px 0', fontSize: '1.4rem' }}>
                    {SITE_CONFIG.brand.name.toUpperCase()}
                </h2>

                {/* Datos Legales y Contacto (Variables Universales) */}
                <div style={{ fontSize: '0.75rem', lineHeight: '1.2', marginBottom: '8px' }}>
                    {SITE_CONFIG.brand.nit && <p style={{ margin: 0 }}>NIT: {SITE_CONFIG.brand.nit}</p>}
                    <p style={{ margin: 0 }}>{SITE_CONFIG.brand.address}</p>
                    <p style={{ margin: 0 }}>Tel: {SITE_CONFIG.brand.phone}</p>
                </div>

                {/* Línea Divisora Sutil */}
                <div style={{ borderTop: '1px solid #000', width: '60%', margin: '8px auto' }}></div>

                {/* Información de la Orden */}
                <p style={{ fontSize: '1rem', fontWeight: 'bold', margin: '5px 0' }}>
                    {mostrarEncabezadoMesa()}
                </p>
                
                <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                    <p style={{ margin: '2px 0' }}>
                        <span style={{ fontWeight: 'bold' }}>Mesero:</span> {data.mesero}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#333' }}>
                        {new Date(data.fecha).toLocaleString('es-CO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        })}
                    </p>
                </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000' }} />

            {/* 🛒 TABLA DE PRODUCTOS OPTIMIZADA */}
            <table style={{ 
                width: '100%', 
                fontSize: '0.85rem', 
                borderCollapse: 'collapse',
                marginTop: '5px' 
            }}>
                <thead>
        <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ textAlign: 'left', width: '35px', padding: '5px 0' }}>CANT</th>
            <th style={{ textAlign: 'left' }}>PRODUCTO</th>
            <th style={{ textAlign: 'right', width: '85px' }}>TOTAL</th>
        </tr>
    </thead>
    <tbody>
        {(() => {
            // 🧠 AGRUPACIÓN POR IDENTIDAD (Nombre + Precio)
            const productosAgrupados = data.productos.reduce((acc, current) => {
                // Creamos una llave única para que si el mismo producto tiene dos precios distintos (raro, pero posible), no los mezcle
                const llave = `${current.nombre.trim().toUpperCase()}-${current.precioNum}`;
                
                if (acc[llave]) {
                    acc[llave].cantidad += current.cantidad;
                } else {
                    acc[llave] = { ...current };
                }
                return acc;
            }, {});

            // Convertimos el objeto de vuelta a un array para el map
            return Object.values(productosAgrupados).map((item, index) => (
                <tr key={index} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                        {item.cantidad}
                    </td>
                    <td style={{ 
                        padding: '6px 0', 
                        wordBreak: 'break-word',
                        paddingRight: '5px' 
                    }}>
                        {item.nombre.toUpperCase()}
                        {/* 💡 Tip Senior: Si quieres que el cliente sepa el unitario cuando es más de uno */}
                        {item.cantidad > 1 && (
                            <div style={{ fontSize: '0.7rem', color: '#666' }}>
                                (UNID: ${item.precioNum.toLocaleString()})
                            </div>
                        )}
                    </td>
                    <td style={{ 
                        textAlign: 'right', 
                        verticalAlign: 'top', 
                        fontWeight: 'bold',
                        padding: '6px 0' 
                    }}>
                        ${(item.precioNum * item.cantidad).toLocaleString()}
                    </td>
                </tr>
            ));
        })()}
    </tbody>
</table>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', marginTop: '10px' }} />
{/* 💰 SECCIÓN DE TOTALES BLINDADA Y ALINEADA */}
            <div style={{ marginTop: '10px', fontSize: '0.95rem' }}>
                
                {/* Subtotal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>SUBTOTAL:</span>
                    <span>${totalProductos.toLocaleString()}</span>
                </div>
                
                {/* Propina Detallada */}
                {valorPropina > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                        <span>PROPINA ({data.propina === -1 ? 'Manual' : `${data.propina}%`}):</span>
                        <span>${valorPropina.toLocaleString()}</span>
                    </div>
                )}

                {/* Total Final Resaltado */}
                <div style={{ 
                    borderTop: '2px solid #000', 
                    marginTop: '8px', 
                    paddingTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>TOTAL A PAGAR:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.3rem' }}>
                        {SITE_CONFIG.brand.symbol}{totalFinal.toLocaleString()}
                    </span>
                </div>
            </div>
            {/* 🛵 DATOS DE ENTREGA (NUEVA SECCIÓN) */}
            {data.tipoOrden === 'domicilio' && data.datosEntrega && (
                <div style={{ 
                    marginTop: '15px', 
                    padding: '10px', 
                    border: '1.5px solid #000', 
                    borderRadius: '4px',
                    fontSize: '0.9rem' 
                }}>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '5px' }}>
                        DATOS PARA EL DOMICILIO
                    </div>
                    <p style={{ margin: '3px 0' }}><strong>CLIENTE:</strong> {data.datosEntrega.nombreCliente?.toUpperCase()}</p>
                    <p style={{ margin: '3px 0' }}><strong>DIRECCIÓN:</strong> {data.datosEntrega.direccion?.toUpperCase()}</p>
                    <p style={{ margin: '3px 0' }}><strong>TELÉFONO:</strong> {data.datosEntrega.telefono}</p>
                </div>
            )}
         
            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem' }}>
                ¡Gracias por su visita!
            </p>

            <style jsx>{`
                @media print {
                    .no-print { display: none !important; }
                    body { padding: 0; margin: 0; }
                }
            `}</style>
        </div>
    );
}